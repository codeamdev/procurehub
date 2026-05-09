from django.urls import path, include
from rest_framework_nested import routers
from rest_framework.routers import DefaultRouter
from .views import ProcurementRequestViewSet, ProposalViewSet

router = DefaultRouter()
router.register(r'requests', ProcurementRequestViewSet, basename='procurement-request')

# Nested: /requests/{id}/proposals/
proposals_router = routers.NestedDefaultRouter(router, r'requests', lookup='request')
proposals_router.register(r'proposals', ProposalViewSet, basename='proposal')

urlpatterns = [
    path('', include(router.urls)),
    path('', include(proposals_router.urls)),
]
