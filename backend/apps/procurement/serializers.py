from rest_framework import serializers
from .models import ProcurementRequest, Proposal


class ProposalSerializer(serializers.ModelSerializer):
    supplier_email = serializers.EmailField(source='supplier.email', read_only=True)

    class Meta:
        model = Proposal
        fields = ('id', 'request', 'supplier', 'supplier_email',
                  'price', 'delivery_time', 'message', 'status', 'created_at')
        read_only_fields = ('id', 'request', 'supplier', 'status', 'created_at', 'supplier_email')


class ProcurementRequestSerializer(serializers.ModelSerializer):
    proposals = ProposalSerializer(many=True, read_only=True)
    created_by_email = serializers.EmailField(source='created_by.email', read_only=True)
    proposal_count = serializers.IntegerField(source='proposals.count', read_only=True)

    class Meta:
        model = ProcurementRequest
        fields = ('id', 'title', 'description', 'budget', 'category', 'deadline',
                  'status', 'created_by', 'created_by_email', 'proposal_count',
                  'proposals', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_by', 'status', 'created_at', 'updated_at',
                            'created_by_email', 'proposal_count')

    def validate_budget(self, value):
        if value <= 0:
            raise serializers.ValidationError('Budget must be greater than 0.')
        return value
