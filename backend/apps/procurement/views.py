import logging
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminOrBuyer, IsApprovedSupplier
from .models import ProcurementRequest, Proposal
from .serializers import ProcurementRequestSerializer, ProposalSerializer
from . import services

logger = logging.getLogger(__name__)


class ProcurementRequestViewSet(viewsets.ModelViewSet):
    serializer_class = ProcurementRequestSerializer

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy',
                           'close_request', 'award_request'):
            return [IsAdminOrBuyer()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = ProcurementRequest.objects.select_related('created_by') \
                                       .prefetch_related('proposals__supplier')
        if user.role == 'supplier':
            if not user.is_approved:
                return qs.none()
            return qs.filter(status=ProcurementRequest.Status.OPEN)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        req = services.create_procurement_request(request.user, serializer.validated_data)
        return Response(self.get_serializer(req).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='close')
    def close_request(self, request, pk=None):
        req = self.get_object()
        updated = services.close_procurement_request(request.user, req)
        return Response(self.get_serializer(updated).data)

    @action(detail=True, methods=['post'], url_path='award')
    def award_request(self, request, pk=None):
        proposal_id = request.data.get('proposal_id')
        if not proposal_id:
            raise ValidationError({'proposal_id': 'This field is required.'})
        req = self.get_object()
        updated = services.award_procurement_request(request.user, req, proposal_id)
        return Response(self.get_serializer(updated).data)


class ProposalViewSet(
    viewsets.GenericViewSet,
    viewsets.mixins.ListModelMixin,
    viewsets.mixins.RetrieveModelMixin,
    viewsets.mixins.CreateModelMixin,
):
    """Proposals are immutable once submitted — no update or delete allowed."""
    serializer_class = ProposalSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [IsApprovedSupplier()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = Proposal.objects.select_related('supplier').filter(
            request_id=self.kwargs['request_pk']
        )
        if user.role == 'supplier':
            return qs.filter(supplier=user)
        return qs

    def create(self, request, *args, **kwargs):
        req = get_object_or_404(ProcurementRequest, pk=self.kwargs['request_pk'])
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        proposal = services.submit_proposal(request.user, req, serializer.validated_data)
        return Response(self.get_serializer(proposal).data, status=status.HTTP_201_CREATED)
