import logging
from django.db import transaction
from apps.common.exceptions import NotFoundError, ConflictError
from .models import ProcurementRequest, Proposal

logger = logging.getLogger(__name__)


def create_procurement_request(user, data: dict) -> ProcurementRequest:
    req = ProcurementRequest.objects.create(created_by=user, **data)
    logger.info('ProcurementRequest %d created by user %d', req.pk, user.pk)
    return req


def close_procurement_request(user, req: ProcurementRequest) -> ProcurementRequest:
    if req.status != ProcurementRequest.Status.OPEN:
        raise ConflictError(f'Cannot close a request with status "{req.status}".')
    req.status = ProcurementRequest.Status.CLOSED
    req.save(update_fields=['status', 'updated_at'])
    logger.info('ProcurementRequest %d closed by user %d', req.pk, user.pk)
    return req


@transaction.atomic
def award_procurement_request(user, req: ProcurementRequest, proposal_id: int) -> ProcurementRequest:
    if req.status != ProcurementRequest.Status.OPEN:
        raise ConflictError(f'Cannot award a request with status "{req.status}".')

    # Re-fetch with lock to prevent concurrent awards
    req = ProcurementRequest.objects.select_for_update().get(pk=req.pk)

    try:
        winning = req.proposals.get(pk=proposal_id)
    except Proposal.DoesNotExist:
        raise NotFoundError('Proposal not found on this request.')

    winning.status = Proposal.Status.ACCEPTED
    winning.save(update_fields=['status'])
    req.proposals.exclude(pk=proposal_id).update(status=Proposal.Status.REJECTED)
    req.status = ProcurementRequest.Status.AWARDED
    req.save(update_fields=['status', 'updated_at'])

    logger.info(
        'ProcurementRequest %d awarded to proposal %d by user %d',
        req.pk, proposal_id, user.pk,
    )
    return req


def submit_proposal(supplier, req: ProcurementRequest, data: dict) -> Proposal:
    if req.status != ProcurementRequest.Status.OPEN:
        raise ConflictError('Proposals can only be submitted for open requests.')

    if Proposal.objects.filter(request=req, supplier=supplier).exists():
        raise ConflictError('You have already submitted a proposal for this request.')

    proposal = Proposal.objects.create(request=req, supplier=supplier, **data)
    logger.info(
        'Proposal %d submitted by supplier %d for request %d',
        proposal.pk, supplier.pk, req.pk,
    )
    return proposal
