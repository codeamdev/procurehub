from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Category, SupplierProfile, BuyerProfile

User = get_user_model()

_SELF_REGISTRABLE_ROLES = [User.Role.BUYER, User.Role.SUPPLIER]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(
        choices=_SELF_REGISTRABLE_ROLES,
        default=User.Role.BUYER,
    )

    class Meta:
        model = User
        fields = ('email', 'password', 'role')

    def create(self, validated_data):
        role = validated_data.get('role', User.Role.BUYER)
        return User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            role=role,
            is_approved=(role != User.Role.SUPPLIER),
        )


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'email', 'role', 'is_active', 'is_approved')
        read_only_fields = ('id', 'is_active', 'is_approved')


# ── Category ──────────────────────────────────────────────────────────────────

class CategorySerializer(serializers.ModelSerializer):
    supplier_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ('id', 'name', 'description', 'supplier_count', 'created_at')
        read_only_fields = ('id', 'created_at')

    def get_supplier_count(self, obj):
        return obj.suppliers.count()


# ── Supplier Profile ──────────────────────────────────────────────────────────

class SupplierProfileSerializer(serializers.ModelSerializer):
    categories = CategorySerializer(many=True, read_only=True)
    category_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Category.objects.all(),
        source='categories', write_only=True, required=False,
    )

    class Meta:
        model = SupplierProfile
        fields = (
            'id', 'company_name', 'tax_id', 'address',
            'phone', 'website', 'description',
            'categories', 'category_ids',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

    def update(self, instance, validated_data):
        categories = validated_data.pop('categories', None)
        instance = super().update(instance, validated_data)
        if categories is not None:
            instance.categories.set(categories)
        return instance


class SupplierSerializer(serializers.ModelSerializer):
    """Full supplier representation with profile."""
    profile = SupplierProfileSerializer(source='supplier_profile', read_only=True)

    class Meta:
        model = User
        fields = ('id', 'email', 'role', 'is_active', 'is_approved', 'profile')
        read_only_fields = fields


# ── Buyer Profile ─────────────────────────────────────────────────────────────

class BuyerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = BuyerProfile
        fields = ('id', 'company_name', 'department', 'phone', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')


class BuyerSerializer(serializers.ModelSerializer):
    """Full buyer representation with profile."""
    profile = BuyerProfileSerializer(source='buyer_profile', read_only=True)

    class Meta:
        model = User
        fields = ('id', 'email', 'role', 'is_active', 'is_approved', 'profile')
        read_only_fields = fields
