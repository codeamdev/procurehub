from django.contrib import admin
from .models import ProcurementRequest, Proposal


class ProposalInline(admin.TabularInline):
    model = Proposal
    extra = 0
    readonly_fields = ('created_at',)


@admin.register(ProcurementRequest)
class ProcurementRequestAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'budget', 'status', 'deadline', 'created_by')
    list_filter = ('status', 'category')
    inlines = [ProposalInline]


@admin.register(Proposal)
class ProposalAdmin(admin.ModelAdmin):
    list_display = ('supplier', 'request', 'price', 'delivery_time', 'status')
    list_filter = ('status',)
