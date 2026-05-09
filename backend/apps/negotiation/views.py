import logging
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminOrBuyer
from .models import (
    NegotiationProcess, NegotiationItem, NegotiationInvite,
    SupplierOffer, OfferLine, PurchaseOrder,
)
from .serializers import (
    NegotiationProcessSerializer, NegotiationProcessDetailSerializer,
    NegotiationItemSerializer,
    NegotiationInviteSerializer,
    SupplierOfferSerializer, SupplierOfferWriteSerializer,
    PurchaseOrderSerializer,
)

logger = logging.getLogger(__name__)


# ── NegotiationProcess ────────────────────────────────────────────────────────

class NegotiationProcessViewSet(viewsets.ModelViewSet):
    """
    CRUD for negotiation processes.
    Admin/buyer: full access.
    Supplier: see only processes they are invited to.
    """
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy',
                           'publish', 'close', 'invite', 'uninvite',
                           'accept_offer', 'reject_offer', 'generate_order'):
            return [IsAdminOrBuyer()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = NegotiationProcess.objects.prefetch_related('items', 'invites', 'offers')
        if user.role == 'supplier':
            qs = qs.filter(invites__supplier=user)
        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return NegotiationProcessDetailSerializer
        return NegotiationProcessSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    # ── Status transitions ────────────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        process = self.get_object()
        if process.status != NegotiationProcess.Status.DRAFT:
            raise ValidationError({'detail': 'Solo los procesos en borrador pueden publicarse.'})
        process.status = NegotiationProcess.Status.OPEN
        process.save(update_fields=['status', 'updated_at'])
        return Response(NegotiationProcessSerializer(process).data)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        process = self.get_object()
        if process.status not in (NegotiationProcess.Status.OPEN,
                                  NegotiationProcess.Status.EVALUATING):
            raise ValidationError({'detail': 'El proceso no puede cerrarse en su estado actual.'})
        process.status = NegotiationProcess.Status.CLOSED
        process.save(update_fields=['status', 'updated_at'])
        return Response(NegotiationProcessSerializer(process).data)

    @action(detail=True, methods=['post'], url_path='set-evaluating')
    def set_evaluating(self, request, pk=None):
        process = self.get_object()
        if process.status != NegotiationProcess.Status.OPEN:
            raise ValidationError({'detail': 'El proceso debe estar abierto.'})
        process.status = NegotiationProcess.Status.EVALUATING
        process.save(update_fields=['status', 'updated_at'])
        return Response(NegotiationProcessSerializer(process).data)

    # ── Items ─────────────────────────────────────────────────────────────────

    @action(detail=True, methods=['get', 'post'], url_path='items')
    def items(self, request, pk=None):
        process = self.get_object()
        if request.method == 'GET':
            return Response(NegotiationItemSerializer(process.items.all(), many=True).data)
        if process.status != NegotiationProcess.Status.DRAFT:
            raise ValidationError({'detail': 'Solo se pueden editar ítems en procesos en borrador.'})
        ser = NegotiationItemSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save(process=process, order=process.items.count())
        return Response(ser.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch', 'delete'], url_path='items/(?P<item_pk>[^/.]+)')
    def item_detail(self, request, pk=None, item_pk=None):
        process = self.get_object()
        try:
            item = process.items.get(pk=item_pk)
        except NegotiationItem.DoesNotExist:
            return Response({'detail': 'Ítem no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        if request.method == 'DELETE':
            item.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        ser = NegotiationItemSerializer(item, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    # ── Invites ───────────────────────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def invite(self, request, pk=None):
        process = self.get_object()
        supplier_id = request.data.get('supplier_id')
        if not supplier_id:
            raise ValidationError({'supplier_id': 'Requerido.'})
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            supplier = User.objects.get(pk=supplier_id, role='supplier')
        except User.DoesNotExist:
            raise ValidationError({'supplier_id': 'Proveedor no encontrado.'})
        invite, created = NegotiationInvite.objects.get_or_create(
            process=process, supplier=supplier,
        )
        return Response(
            NegotiationInviteSerializer(invite).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=True, methods=['delete'], url_path='invite/(?P<invite_pk>[^/.]+)')
    def uninvite(self, request, pk=None, invite_pk=None):
        process = self.get_object()
        try:
            invite = process.invites.get(pk=invite_pk)
        except NegotiationInvite.DoesNotExist:
            return Response({'detail': 'Invitación no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        invite.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Offers ────────────────────────────────────────────────────────────────

    @action(detail=True, methods=['get'], url_path='compare')
    def compare(self, request, pk=None):
        """Returns a comparison matrix: items × suppliers."""
        process = self.get_object()
        items = list(process.items.order_by('order', 'name'))
        offers = list(
            process.offers
            .exclude(status=SupplierOffer.OfferStatus.DRAFT)
            .prefetch_related('lines__item')
            .select_related('supplier__supplier_profile')
        )

        comparison = {
            'items': NegotiationItemSerializer(items, many=True).data,
            'offers': [],
        }

        for offer in offers:
            lines_by_item = {str(line.item_id): line for line in offer.lines.all()}
            offer_data = {
                'id': str(offer.id),
                'supplier_email': offer.supplier.email,
                'supplier_name': (
                    getattr(getattr(offer.supplier, 'supplier_profile', None), 'company_name', None)
                    or offer.supplier.email
                ),
                'delivery_days': offer.delivery_days,
                'validity_days': offer.validity_days,
                'notes': offer.notes,
                'status': offer.status,
                'lines': {
                    str(item.id): {
                        'unit_price': float(lines_by_item[str(item.id)].unit_price)
                        if str(item.id) in lines_by_item else None,
                        'total': float(
                            lines_by_item[str(item.id)].unit_price * item.quantity
                        ) if str(item.id) in lines_by_item else None,
                        'notes': lines_by_item[str(item.id)].notes
                        if str(item.id) in lines_by_item else '',
                    }
                    for item in items
                },
                'total_amount': float(sum(
                    lines_by_item[str(item.id)].unit_price * item.quantity
                    for item in items
                    if str(item.id) in lines_by_item
                )),
            }
            comparison['offers'].append(offer_data)

        return Response(comparison)

    @action(detail=True, methods=['post'], url_path='offers/(?P<offer_pk>[^/.]+)/accept')
    def accept_offer(self, request, pk=None, offer_pk=None):
        process = self.get_object()
        try:
            offer = process.offers.get(pk=offer_pk, status=SupplierOffer.OfferStatus.SUBMITTED)
        except SupplierOffer.DoesNotExist:
            return Response({'detail': 'Oferta no encontrada o no enviada.'}, status=status.HTTP_404_NOT_FOUND)

        # Accept this offer
        offer.status = SupplierOffer.OfferStatus.ACCEPTED
        offer.save(update_fields=['status', 'updated_at'])

        # Reject all other submitted offers
        process.offers.filter(
            status=SupplierOffer.OfferStatus.SUBMITTED
        ).exclude(pk=offer.pk).update(status=SupplierOffer.OfferStatus.REJECTED)

        # Generate purchase order
        total = float(sum(
            line.unit_price * line.item.quantity
            for line in offer.lines.select_related('item')
        ))
        order = PurchaseOrder.objects.create(
            process=process,
            offer=offer,
            supplier=offer.supplier,
            total_amount=total,
            created_by=request.user,
        )

        process.status = NegotiationProcess.Status.CLOSED
        process.save(update_fields=['status', 'updated_at'])

        return Response({
            'offer': SupplierOfferSerializer(offer).data,
            'order': PurchaseOrderSerializer(order).data,
        })

    @action(detail=True, methods=['post'], url_path='offers/(?P<offer_pk>[^/.]+)/reject')
    def reject_offer(self, request, pk=None, offer_pk=None):
        process = self.get_object()
        try:
            offer = process.offers.get(pk=offer_pk)
        except SupplierOffer.DoesNotExist:
            return Response({'detail': 'Oferta no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        offer.status = SupplierOffer.OfferStatus.REJECTED
        offer.save(update_fields=['status', 'updated_at'])
        return Response(SupplierOfferSerializer(offer).data)


# ── SupplierOffer (supplier self-service) ─────────────────────────────────────

class SupplierOfferViewSet(viewsets.GenericViewSet):
    """
    Suppliers manage their own offers.
    GET  /api/negotiations/{process_pk}/my-offer/  → view own offer
    PUT  /api/negotiations/{process_pk}/my-offer/  → save/update draft
    POST /api/negotiations/{process_pk}/my-offer/submit/ → submit
    """
    permission_classes = [IsAuthenticated]

    def _get_process(self, process_pk):
        try:
            return NegotiationProcess.objects.get(pk=process_pk)
        except NegotiationProcess.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound('Proceso de negociación no encontrado.')

    def _require_supplier(self, request):
        if request.user.role != 'supplier':
            raise PermissionDenied('Solo los proveedores pueden gestionar ofertas.')

    def retrieve(self, request, process_pk=None):
        self._require_supplier(request)
        process = self._get_process(process_pk)
        offer = SupplierOffer.objects.filter(process=process, supplier=request.user).first()
        if not offer:
            return Response({'detail': 'No tienes oferta para este proceso.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(SupplierOfferSerializer(offer).data)

    def update(self, request, process_pk=None):
        self._require_supplier(request)
        process = self._get_process(process_pk)

        if not process.invites.filter(supplier=request.user).exists():
            raise PermissionDenied('No estás invitado a este proceso.')
        if process.status not in (NegotiationProcess.Status.OPEN,
                                  NegotiationProcess.Status.EVALUATING):
            raise ValidationError({'detail': 'El proceso no acepta ofertas en este momento.'})

        offer, _ = SupplierOffer.objects.get_or_create(process=process, supplier=request.user)
        if offer.status == SupplierOffer.OfferStatus.SUBMITTED:
            raise ValidationError({'detail': 'No puedes editar una oferta ya enviada.'})

        ser = SupplierOfferWriteSerializer(offer, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(SupplierOfferSerializer(offer).data)

    @action(detail=False, methods=['post'])
    def submit(self, request, process_pk=None):
        self._require_supplier(request)
        process = self._get_process(process_pk)
        offer = SupplierOffer.objects.filter(process=process, supplier=request.user).first()
        if not offer:
            raise ValidationError({'detail': 'Guarda tu oferta antes de enviarla.'})
        if offer.status != SupplierOffer.OfferStatus.DRAFT:
            raise ValidationError({'detail': 'La oferta ya fue enviada.'})
        if not offer.lines.exists():
            raise ValidationError({'detail': 'Agrega al menos una línea de precio antes de enviar.'})

        offer.status = SupplierOffer.OfferStatus.SUBMITTED
        offer.submitted_at = timezone.now()
        offer.save(update_fields=['status', 'submitted_at', 'updated_at'])
        return Response(SupplierOfferSerializer(offer).data)


# ── PurchaseOrder ─────────────────────────────────────────────────────────────

class PurchaseOrderViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = PurchaseOrderSerializer

    def get_queryset(self):
        user = self.request.user
        qs = PurchaseOrder.objects.select_related(
            'process', 'offer', 'supplier', 'supplier__supplier_profile', 'created_by',
        )
        if user.role == 'supplier':
            qs = qs.filter(supplier=user)
        process_id = self.request.query_params.get('process')
        if process_id:
            qs = qs.filter(process_id=process_id)
        return qs

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'update_status'):
            return [IsAdminOrBuyer()]
        return [IsAuthenticated()]

    @action(detail=True, methods=['post'], url_path='status')
    def update_status(self, request, pk=None):
        order = self.get_object()
        new_status = request.data.get('status')
        valid = [s[0] for s in PurchaseOrder.OrderStatus.choices]
        if new_status not in valid:
            raise ValidationError({'status': f'Debe ser uno de: {valid}'})
        order.status = new_status
        order.save(update_fields=['status', 'updated_at'])
        return Response(PurchaseOrderSerializer(order).data)
