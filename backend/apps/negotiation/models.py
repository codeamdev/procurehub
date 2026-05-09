import uuid
from django.db import models
from django.conf import settings

User = settings.AUTH_USER_MODEL


class NegotiationProcess(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Borrador'
        OPEN = 'open', 'Abierto'
        EVALUATING = 'evaluating', 'En evaluación'
        CLOSED = 'closed', 'Cerrado'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    deadline = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='negotiation_processes',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.title} [{self.status}]'


class NegotiationItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    process = models.ForeignKey(
        NegotiationProcess, on_delete=models.CASCADE, related_name='items',
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    quantity = models.DecimalField(max_digits=14, decimal_places=4)
    unit = models.CharField(max_length=50, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'name']

    def __str__(self):
        return f'{self.name} × {self.quantity} {self.unit}'


class NegotiationInvite(models.Model):
    class InviteStatus(models.TextChoices):
        PENDING = 'pending', 'Pendiente'
        ACCEPTED = 'accepted', 'Aceptado'
        DECLINED = 'declined', 'Rechazado'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    process = models.ForeignKey(
        NegotiationProcess, on_delete=models.CASCADE, related_name='invites',
    )
    supplier = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='negotiation_invites',
        limit_choices_to={'role': 'supplier'},
    )
    status = models.CharField(
        max_length=20, choices=InviteStatus.choices, default=InviteStatus.PENDING,
    )
    invited_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('process', 'supplier')

    def __str__(self):
        return f'{self.supplier.email} → {self.process.title}'


class SupplierOffer(models.Model):
    class OfferStatus(models.TextChoices):
        DRAFT = 'draft', 'Borrador'
        SUBMITTED = 'submitted', 'Enviada'
        ACCEPTED = 'accepted', 'Aceptada'
        REJECTED = 'rejected', 'Rechazada'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    process = models.ForeignKey(
        NegotiationProcess, on_delete=models.CASCADE, related_name='offers',
    )
    supplier = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='supplier_offers',
        limit_choices_to={'role': 'supplier'},
    )
    notes = models.TextField(blank=True)
    delivery_days = models.PositiveIntegerField(null=True, blank=True)
    validity_days = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=OfferStatus.choices, default=OfferStatus.DRAFT,
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('process', 'supplier')
        ordering = ['-submitted_at', '-created_at']

    def __str__(self):
        return f'{self.supplier.email} — {self.process.title}'


class OfferLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    offer = models.ForeignKey(
        SupplierOffer, on_delete=models.CASCADE, related_name='lines',
    )
    item = models.ForeignKey(
        NegotiationItem, on_delete=models.CASCADE, related_name='offer_lines',
    )
    unit_price = models.DecimalField(max_digits=14, decimal_places=2)
    notes = models.CharField(max_length=300, blank=True)

    class Meta:
        unique_together = ('offer', 'item')

    def __str__(self):
        return f'{self.item.name}: {self.unit_price}'


class PurchaseOrder(models.Model):
    class OrderStatus(models.TextChoices):
        DRAFT = 'draft', 'Borrador'
        SENT = 'sent', 'Enviada'
        CONFIRMED = 'confirmed', 'Confirmada'
        COMPLETED = 'completed', 'Completada'
        CANCELLED = 'cancelled', 'Cancelada'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    process = models.ForeignKey(
        NegotiationProcess, on_delete=models.SET_NULL, null=True, related_name='orders',
    )
    offer = models.OneToOneField(
        SupplierOffer, on_delete=models.SET_NULL, null=True, related_name='purchase_order',
    )
    supplier = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='purchase_orders_received',
        limit_choices_to={'role': 'supplier'},
    )
    total_amount = models.DecimalField(max_digits=14, decimal_places=2)
    notes = models.TextField(blank=True)
    status = models.CharField(
        max_length=20, choices=OrderStatus.choices, default=OrderStatus.DRAFT,
    )
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='purchase_orders_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'OC-{str(self.id)[:8]} [{self.status}]'
