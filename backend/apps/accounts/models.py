from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'admin', 'Admin'
        BUYER = 'buyer', 'Buyer'
        SUPPLIER = 'supplier', 'Supplier'

    objects = UserManager()

    username = None
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.BUYER)
    is_approved = models.BooleanField(default=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email


# ── Categories ────────────────────────────────────────────────────────────────

class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'categories'

    def __str__(self):
        return self.name


# ── Supplier Profile ──────────────────────────────────────────────────────────

class SupplierProfile(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='supplier_profile',
        limit_choices_to={'role': User.Role.SUPPLIER},
    )
    company_name = models.CharField(max_length=200, blank=True)
    tax_id = models.CharField(max_length=30, blank=True, verbose_name='RUC/NIT')
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    website = models.URLField(blank=True)
    description = models.TextField(blank=True)
    categories = models.ManyToManyField(Category, blank=True, related_name='suppliers')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.company_name or self.user.email} (proveedor)'


# ── Buyer Profile ─────────────────────────────────────────────────────────────

class BuyerProfile(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='buyer_profile',
        limit_choices_to={'role__in': [User.Role.BUYER, User.Role.ADMIN]},
    )
    company_name = models.CharField(max_length=200, blank=True)
    department = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.company_name or self.user.email} (comprador)'
