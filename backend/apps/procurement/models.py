from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator


class ProcurementRequest(models.Model):
    class Status(models.TextChoices):
        OPEN = 'open', 'Open'
        CLOSED = 'closed', 'Closed'
        AWARDED = 'awarded', 'Awarded'

    title = models.CharField(max_length=255)
    description = models.TextField()
    budget = models.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(0.01)]
    )
    category = models.CharField(max_length=100)
    deadline = models.DateField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                   related_name='procurement_requests')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class Proposal(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACCEPTED = 'accepted', 'Accepted'
        REJECTED = 'rejected', 'Rejected'

    request = models.ForeignKey(ProcurementRequest, on_delete=models.CASCADE,
                                related_name='proposals')
    supplier = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                 related_name='proposals',
                                 limit_choices_to={'role': 'supplier'})
    price = models.DecimalField(max_digits=12, decimal_places=2,
                                validators=[MinValueValidator(0.01)])
    delivery_time = models.PositiveIntegerField(help_text='Days to deliver')
    message = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('request', 'supplier')
        ordering = ['price']

    def __str__(self):
        return f"Proposal by {self.supplier.email} for {self.request.title}"
