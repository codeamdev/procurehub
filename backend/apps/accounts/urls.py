from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

router = DefaultRouter()
router.register('categories', views.CategoryViewSet, basename='category')
router.register('suppliers-v2', views.SupplierViewSet, basename='supplier-v2')
router.register('buyers', views.BuyerViewSet, basename='buyer')

urlpatterns = [
    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),
    path('logout/', views.logout, name='logout'),
    path('me/', views.me, name='me'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # Legacy supplier approval endpoints (kept for backward compatibility)
    path('suppliers/', include('apps.accounts.supplier_urls')),
    # New profile/management endpoints
    path('', include(router.urls)),
]
