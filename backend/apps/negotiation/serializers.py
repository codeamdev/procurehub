from django.utils import timezone
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    NegotiationProcess, NegotiationItem, NegotiationInvite,
    SupplierOffer, OfferLine, PurchaseOrder,
)

User = get_user_model()


# ── NegotiationItem ───────────────────────────────────────────────────────────

class NegotiationItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = NegotiationItem
        fields = ('id', 'name', 'description', 'quantity', 'unit', 'order')
        read_only_fields = ('id',)


# ── NegotiationInvite ─────────────────────────────────────────────────────────

class NegotiationInviteSerializer(serializers.ModelSerializer):
    supplier_email = serializers.EmailField(source='supplier.email', read_only=True)
    supplier_name = serializers.SerializerMethodField()

    class Meta:
        model = NegotiationInvite
        fields = ('id', 'supplier', 'supplier_email', 'supplier_name',
                  'status', 'invited_at', 'responded_at')
        read_only_fields = ('id', 'supplier_email', 'supplier_name',
                            'invited_at', 'responded_at')

    def get_supplier_name(self, obj):
        try:
            return obj.supplier.supplier_profile.company_name or obj.supplier.email
        except Exception:
            return obj.supplier.email


# ── OfferLine ─────────────────────────────────────────────────────────────────

class OfferLineSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_quantity = serializers.DecimalField(
        source='item.quantity', max_digits=14, decimal_places=4, read_only=True,
    )
    item_unit = serializers.CharField(source='item.unit', read_only=True)
    total = serializers.SerializerMethodField()

    class Meta:
        model = OfferLine
        fields = ('id', 'item', 'item_name', 'item_quantity', 'item_unit',
                  'unit_price', 'notes', 'total')
        read_only_fields = ('id', 'item_name', 'item_quantity', 'item_unit', 'total')

    def get_total(self, obj):
        try:
            return float(obj.unit_price * obj.item.quantity)
        except Exception:
            return None


# ── SupplierOffer ─────────────────────────────────────────────────────────────

class SupplierOfferSerializer(serializers.ModelSerializer):
    supplier_email = serializers.EmailField(source='supplier.email', read_only=True)
    supplier_name = serializers.SerializerMethodField()
    lines = OfferLineSerializer(many=True, read_only=True)
    total_amount = serializers.SerializerMethodField()

    class Meta:
        model = SupplierOffer
        fields = (
            'id', 'supplier', 'supplier_email', 'supplier_name',
            'notes', 'delivery_days', 'validity_days',
            'status', 'submitted_at',
            'lines', 'total_amount',
            'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'supplier', 'supplier_email', 'supplier_name',
            'status', 'submitted_at', 'created_at', 'updated_at',
        )

    def get_supplier_name(self, obj):
        try:
            return obj.supplier.supplier_profile.company_name or obj.supplier.email
        except Exception:
            return obj.supplier.email

    def get_total_amount(self, obj):
        try:
            return float(sum(
                line.unit_price * line.item.quantity
                for line in obj.lines.select_related('item')
            ))
        except Exception:
            return None


class SupplierOfferWriteSerializer(serializers.ModelSerializer):
    lines = OfferLineSerializer(many=True, required=False)

    class Meta:
        model = SupplierOffer
        fields = ('notes', 'delivery_days', 'validity_days', 'lines')

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)
        instance = super().update(instance, validated_data)
        if lines_data is not None:
            # Replace all lines
            instance.lines.all().delete()
            for line_data in lines_data:
                OfferLine.objects.create(offer=instance, **line_data)
        return instance


# ── NegotiationProcess ────────────────────────────────────────────────────────

class NegotiationProcessSerializer(serializers.ModelSerializer):
    """Flat list view — no nested data."""
    created_by_email = serializers.EmailField(source='created_by.email', read_only=True)
    invite_count = serializers.SerializerMethodField()
    offer_count  = serializers.SerializerMethodField()
    item_count   = serializers.SerializerMethodField()

    class Meta:
        model = NegotiationProcess
        fields = (
            'id', 'title', 'description', 'deadline', 'status',
            'created_by_email', 'invite_count', 'offer_count', 'item_count',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'created_by_email', 'invite_count',
                            'offer_count', 'item_count', 'created_at', 'updated_at')

    def get_invite_count(self, obj):
        return obj.invites.count()

    def get_offer_count(self, obj):
        return obj.offers.filter(status=SupplierOffer.OfferStatus.SUBMITTED).count()

    def get_item_count(self, obj):
        return obj.items.count()


class NegotiationProcessDetailSerializer(serializers.ModelSerializer):
    """Full detail view with nested items, invites, offers."""
    created_by_email = serializers.EmailField(source='created_by.email', read_only=True)
    items = NegotiationItemSerializer(many=True, read_only=True)
    invites = NegotiationInviteSerializer(many=True, read_only=True)
    offers = SupplierOfferSerializer(many=True, read_only=True)

    class Meta:
        model = NegotiationProcess
        fields = (
            'id', 'title', 'description', 'deadline', 'status',
            'created_by_email',
            'items', 'invites', 'offers',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'created_by_email', 'created_at', 'updated_at')


# ── PurchaseOrder ─────────────────────────────────────────────────────────────

class PurchaseOrderSerializer(serializers.ModelSerializer):
    supplier_email = serializers.EmailField(source='supplier.email', read_only=True)
    supplier_name = serializers.SerializerMethodField()
    process_title = serializers.CharField(source='process.title', read_only=True)
    created_by_email = serializers.EmailField(source='created_by.email', read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = (
            'id', 'process', 'process_title',
            'supplier', 'supplier_email', 'supplier_name',
            'total_amount', 'notes', 'status',
            'created_by_email', 'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'supplier_email', 'supplier_name', 'process_title',
            'created_by_email', 'created_at', 'updated_at',
        )

    def get_supplier_name(self, obj):
        if not obj.supplier:
            return None
        try:
            return obj.supplier.supplier_profile.company_name or obj.supplier.email
        except Exception:
            return obj.supplier.email
