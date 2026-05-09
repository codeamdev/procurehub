from django.db import models
from django_tenants.models import TenantMixin, DomainMixin


class Company(TenantMixin):
    name = models.CharField(max_length=255)
    created_on = models.DateField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    auto_create_schema = True

    def __str__(self):
        return self.name


class Domain(DomainMixin):
    pass
