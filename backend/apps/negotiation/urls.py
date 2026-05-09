from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register('processes', views.NegotiationProcessViewSet, basename='negotiation-process')
router.register('orders', views.PurchaseOrderViewSet, basename='purchase-order')

urlpatterns = [
    path('', include(router.urls)),
    # Supplier self-service offer endpoints nested under process
    path(
        'processes/<uuid:process_pk>/my-offer/',
        views.SupplierOfferViewSet.as_view({'get': 'retrieve', 'put': 'update'}),
        name='my-offer',
    ),
    path(
        'processes/<uuid:process_pk>/my-offer/submit/',
        views.SupplierOfferViewSet.as_view({'post': 'submit'}),
        name='my-offer-submit',
    ),
]
