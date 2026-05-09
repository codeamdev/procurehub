"""
Supplier AI service layer.

Responsibilities:
  - build_supplier_context   : gather supplier-scoped data for prompt injection
  - generate_suggestions     : structured (stateless) suggestions for a request
  - supplier_chat_response   : conversational response for a supplier message
  - dispatch_supplier_chat   : route to mock or LLM backend

The SUPPLIER_AI_MOCK setting (default True) controls which backend is used.
Set SUPPLIER_AI_MOCK=False to route through the existing OpenAI call_openai().
"""

import json
import logging
from django.conf import settings
from apps.common.exceptions import NotFoundError

logger = logging.getLogger(__name__)

# ── System prompt ─────────────────────────────────────────────────────────────

SUPPLIER_SYSTEM_PROMPT = """\
You are an AI procurement advisor helping a SUPPLIER on a B2B platform.
Your goal: help them understand what buyers need and craft competitive proposals.

You MUST always respond with valid JSON in one of these formats:

1. General message:
   {"type": "message", "content": "your answer"}

2. Request explanation:
   {"type": "explanation",
    "content": "clear summary of what the buyer needs",
    "key_requirements": ["requirement 1", "requirement 2"],
    "risks": ["risk or thing to watch out for"]}

3. Price suggestion:
   {"type": "price_suggestion",
    "suggested_price": 15000.00,
    "range": {"min": 12000.00, "max": 18000.00},
    "reasoning": "why this price makes sense",
    "confidence": "high"}

4. Proposal draft (ready to submit):
   {"type": "proposal_draft",
    "price": 15000.00,
    "delivery_time": 21,
    "message": "full professional proposal text"}

Rules:
- Be specific with numbers. Use the budget and context provided.
- Never invent facts not present in context.
- Keep language professional and concise.
- confidence is: "high" | "medium" | "low"
"""


# ── Context builder ───────────────────────────────────────────────────────────

def build_supplier_context(supplier, request_id=None) -> dict:
    """Gather supplier-scoped data to inject into the AI system prompt."""
    from apps.procurement.models import ProcurementRequest, Proposal

    all_proposals = Proposal.objects.filter(supplier=supplier).select_related('request')
    accepted_count = all_proposals.filter(status='accepted').count()
    total_count = all_proposals.count()

    ctx: dict = {
        'supplier': {
            'email': supplier.email,
            'proposals_submitted': total_count,
            'proposals_won': accepted_count,
            'win_rate_pct': round((accepted_count / total_count * 100) if total_count else 0, 1),
        },
        'recent_proposals': [
            {
                'request_title': p.request.title,
                'category': p.request.category,
                'price': str(p.price),
                'delivery_time': p.delivery_time,
                'status': p.status,
            }
            for p in all_proposals.order_by('-created_at')[:5]
        ],
    }

    if request_id:
        try:
            req = ProcurementRequest.objects.prefetch_related('proposals').get(pk=request_id)
        except ProcurementRequest.DoesNotExist:
            raise NotFoundError('Procurement request not found.')

        similar = all_proposals.filter(
            request__category=req.category
        ).order_by('-created_at')[:3]

        ctx['current_request'] = {
            'id': req.id,
            'title': req.title,
            'description': req.description,
            'budget': str(req.budget),
            'category': req.category,
            'deadline': str(req.deadline),
            'competing_proposals': req.proposals.exclude(supplier=supplier).count(),
            'already_submitted': req.proposals.filter(supplier=supplier).exists(),
        }
        ctx['similar_past_proposals'] = [
            {
                'request': p.request.title,
                'price': str(p.price),
                'delivery_time': p.delivery_time,
                'won': p.status == 'accepted',
            }
            for p in similar
        ]

    return ctx


# ── Suggestions (stateless) ───────────────────────────────────────────────────

def generate_suggestions(supplier, request_id: int) -> dict:
    """
    Return structured suggestions for a specific request.
    Dispatches to mock or LLM based on SUPPLIER_AI_MOCK setting.
    """
    from apps.procurement.models import ProcurementRequest

    try:
        req = ProcurementRequest.objects.prefetch_related('proposals').get(pk=request_id)
    except ProcurementRequest.DoesNotExist:
        raise NotFoundError('Procurement request not found.')

    if getattr(settings, 'SUPPLIER_AI_MOCK', True):
        return _mock_suggestions(supplier, req)

    return _llm_suggestions(supplier, req)


def _mock_suggestions(supplier, req) -> dict:
    """Heuristic suggestions — no LLM required."""
    from apps.procurement.models import Proposal

    budget = float(req.budget)
    competing = req.proposals.exclude(supplier=supplier).count()

    # Price heuristic: back off from budget based on competition
    if competing == 0:
        price_pct = 0.88
        confidence = 'high'
    elif competing <= 2:
        price_pct = 0.80
        confidence = 'medium'
    else:
        price_pct = 0.73
        confidence = 'medium'

    suggested_price = round(budget * price_pct, 2)

    # Delivery heuristic: scale with budget size
    if budget > 50_000:
        delivery_days = 30
    elif budget > 10_000:
        delivery_days = 21
    else:
        delivery_days = 14

    # Adjust delivery based on supplier's historical average
    past = Proposal.objects.filter(supplier=supplier)
    if past.exists():
        avg = sum(p.delivery_time for p in past) / past.count()
        delivery_days = max(delivery_days, int(avg))

    proposal_message = (
        f"Dear Procurement Team,\n\n"
        f"We are pleased to submit our proposal for \"{req.title}\".\n\n"
        f"Having reviewed your requirements carefully, we are confident in delivering "
        f"a high-quality solution that meets your specifications.\n\n"
        f"Our offer:\n"
        f"• Total investment: ${suggested_price:,.2f}\n"
        f"• Delivery timeline: {delivery_days} business days\n"
        f"• Full quality assurance included\n\n"
        f"We have extensive experience in {req.category} and have successfully "
        f"completed similar projects on time and within budget.\n\n"
        f"We welcome the opportunity to discuss further details.\n\n"
        f"Best regards"
    )

    return {
        'price_suggestion': {
            'suggested': suggested_price,
            'range': {
                'min': round(budget * 0.65, 2),
                'max': round(budget * 0.93, 2),
            },
            'reasoning': (
                f"The buyer's budget is ${budget:,.2f}. "
                f"With {competing} competing proposal(s), pricing at "
                f"{int(price_pct * 100)}% of budget is competitive while maintaining margin."
            ),
            'confidence': confidence,
        },
        'delivery_suggestion': {
            'days': delivery_days,
            'reasoning': 'Estimated from request complexity and your historical delivery performance.',
        },
        'proposal_template': {
            'price': suggested_price,
            'delivery_time': delivery_days,
            'message': proposal_message,
        },
        'competitive_insights': {
            'competing_proposals': competing,
            'budget_utilization_pct': int(price_pct * 100),
            'tip': (
                'No competition yet — you can price higher.'
                if competing == 0
                else f'{competing} supplier(s) already submitted. Stay competitive.'
            ),
        },
    }


def _llm_suggestions(supplier, req) -> dict:
    """LLM-powered suggestions via Claude."""
    from .services import call_claude

    ctx = build_supplier_context(supplier, req.pk)
    messages = [
        {
            'role': 'user',
            'content': (
                'Basándote en este contexto, devuelve sugerencias estructuradas para preparar una propuesta. '
                'Devuelve un objeto JSON con las claves: price_suggestion, delivery_suggestion, '
                'proposal_template, competitive_insights.\n\n'
                f'Contexto:\n{json.dumps(ctx, indent=2, ensure_ascii=False)}'
            ),
        },
    ]
    return call_claude(messages, SUPPLIER_SYSTEM_PROMPT)


# ── Chat ──────────────────────────────────────────────────────────────────────

def dispatch_supplier_chat(message: str, context: dict) -> dict:
    """
    Route a supplier chat message to mock or LLM backend.
    context is the dict returned by build_supplier_context().
    """
    if getattr(settings, 'SUPPLIER_AI_MOCK', True):
        return _mock_chat(message, context)

    return _llm_chat(message, context)


def _mock_chat(message: str, ctx: dict) -> dict:
    """Keyword-driven mock — no API key needed."""
    msg = message.lower()
    req = ctx.get('current_request', {})
    budget = float(req.get('budget') or 0)
    competing = req.get('competing_proposals', 0)
    title = req.get('title', 'this request')
    category = req.get('category', 'this category')
    deadline = req.get('deadline', 'the deadline')

    if any(w in msg for w in ('explain', 'understand', 'what', 'need', 'describe', 'mean')):
        return {
            'type': 'explanation',
            'content': (
                f'The buyer is looking for {title} in the {category} category. '
                f'The budget is ${budget:,.2f} and delivery is expected by {deadline}. '
                f'There {"are" if competing != 1 else "is"} currently {competing} '
                f'competing proposal{"s" if competing != 1 else ""} submitted.'
            ),
            'key_requirements': [
                f'Stay within the ${budget:,.2f} budget',
                f'Deliver by {deadline}',
                'Provide a clear price and timeline breakdown',
                'Address the specific requirements in your proposal message',
            ],
            'risks': [
                f'{competing} competing proposal(s) already submitted — price competitively'
                if competing > 0
                else 'First to submit — advantage is yours',
                'Vague proposals are often passed over — be specific',
            ],
        }

    if any(w in msg for w in ('price', 'cost', 'charge', 'rate', 'budget', 'suggest', 'much')):
        price_pct = 0.88 if competing == 0 else (0.80 if competing <= 2 else 0.73)
        suggested = round(budget * price_pct, 2)
        confidence = 'high' if competing == 0 else 'medium'
        return {
            'type': 'price_suggestion',
            'suggested_price': suggested,
            'range': {'min': round(budget * 0.65, 2), 'max': round(budget * 0.93, 2)},
            'reasoning': (
                f'With a buyer budget of ${budget:,.2f} and {competing} competing proposal(s), '
                f'pricing at {int(price_pct * 100)}% of budget (${suggested:,.2f}) '
                f'positions you competitively while maintaining healthy margin.'
            ),
            'confidence': confidence,
        }

    if any(w in msg for w in ('draft', 'proposal', 'write', 'generate', 'create', 'template')):
        price_pct = 0.82
        price = round(budget * price_pct, 2)
        delivery = 21 if budget > 10_000 else 14
        return {
            'type': 'proposal_draft',
            'price': price,
            'delivery_time': delivery,
            'message': (
                f'Dear Procurement Team,\n\n'
                f'We are pleased to submit our proposal for "{title}".\n\n'
                f'Our team has extensive experience in {category} and we are '
                f'confident in delivering a solution that fully meets your requirements.\n\n'
                f'Proposed terms:\n'
                f'• Total price: ${price:,.2f}\n'
                f'• Delivery: {delivery} business days from contract signing\n'
                f'• Includes: quality assurance, documentation, and post-delivery support\n\n'
                f'We would be happy to discuss any adjustments to better fit your needs.\n\n'
                f'Best regards'
            ),
        }

    # Default: helpful guidance
    return {
        'type': 'message',
        'content': (
            f'I\'m here to help you win the "{title}" contract. '
            f'I can:\n'
            f'• **Explain** what the buyer needs\n'
            f'• **Suggest a price** based on competition and budget\n'
            f'• **Draft a proposal** ready to submit\n\n'
            f'What would you like help with?'
        ),
    }


def _llm_chat(message: str, ctx: dict) -> dict:
    """Full LLM chat via Claude."""
    from .services import call_claude

    system = SUPPLIER_SYSTEM_PROMPT + f'\n\nContexto del proveedor:\n{json.dumps(ctx, indent=2, ensure_ascii=False)}'
    messages = [{'role': 'user', 'content': message}]
    result = call_claude(messages, system)

    if 'type' not in result:
        result = {'type': 'message', 'content': str(result)}

    return result
