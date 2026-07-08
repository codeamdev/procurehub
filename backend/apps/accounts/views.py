import logging
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, throttle_classes, action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.views import TokenRefreshView  # noqa: F401
from rest_framework_simplejwt.serializers import TokenRefreshSerializer

from django.conf import settings as django_settings
from django.contrib.auth import get_user_model
from .models import Category, SupplierProfile, BuyerProfile
from .serializers import (
    RegisterSerializer, UserSerializer,
    CategorySerializer,
    SupplierSerializer, SupplierProfileSerializer,
    BuyerSerializer, BuyerProfileSerializer,
)
from .permissions import IsAdmin
from . import services

User = get_user_model()
logger = logging.getLogger(__name__)


class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'


class RegisterRateThrottle(AnonRateThrottle):
    scope = 'register'


# ── Cookie helpers ────────────────────────────────────────────────────────────

_SECURE = not django_settings.DEBUG  # Secure flag en producción

def _set_access_cookie(response, token: str) -> None:
    response.set_cookie(
        'access_token', token,
        max_age=int(django_settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
        httponly=True, samesite='Lax', secure=_SECURE,
    )

def _set_refresh_cookie(response, token: str) -> None:
    response.set_cookie(
        'refresh_token', token,
        max_age=int(django_settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        httponly=True, samesite='Lax', secure=_SECURE,
    )

def _clear_auth_cookies(response) -> None:
    response.delete_cookie('access_token')
    response.delete_cookie('refresh_token')


# ── Auth ──────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([RegisterRateThrottle])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    tokens = services.issue_tokens(user)
    response = Response(
        {'user': UserSerializer(user).data, **tokens},
        status=status.HTTP_201_CREATED,
    )
    _set_access_cookie(response, tokens['access'])
    _set_refresh_cookie(response, tokens['refresh'])
    return response


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def login(request):
    user, tokens = services.authenticate_user(
        request,
        email=request.data.get('email', ''),
        password=request.data.get('password', ''),
    )
    response = Response({'user': UserSerializer(user).data, **tokens})
    _set_access_cookie(response, tokens['access'])
    _set_refresh_cookie(response, tokens['refresh'])
    return response


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    refresh = request.data.get('refresh') or request.COOKIES.get('refresh_token', '')
    if refresh:
        try:
            services.blacklist_token(refresh)
        except Exception:
            pass  # best-effort: el token ya puede estar en la blacklist
    response = Response({'message': 'Logged out successfully.'})
    _clear_auth_cookies(response)
    return response


@api_view(['POST'])
@permission_classes([AllowAny])
def token_refresh_cookie(request):
    """Renueva el access token leyendo el refresh desde la cookie httpOnly."""
    refresh_token = request.COOKIES.get('refresh_token')
    if not refresh_token:
        return Response({'detail': 'No refresh token cookie.'}, status=status.HTTP_401_UNAUTHORIZED)

    ser = TokenRefreshSerializer(data={'refresh': refresh_token}, context={'request': request})
    if not ser.is_valid():
        resp = Response({'detail': 'Refresh token inválido o expirado.'}, status=status.HTTP_401_UNAUTHORIZED)
        _clear_auth_cookies(resp)
        return resp

    resp = Response({'access': ser.validated_data['access']})
    _set_access_cookie(resp, ser.validated_data['access'])
    if 'refresh' in ser.validated_data:
        _set_refresh_cookie(resp, ser.validated_data['refresh'])
    return resp


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(UserSerializer(request.user).data)


# ── Supplier management (admin only — legacy approval endpoints) ───────────────

@api_view(['GET'])
@permission_classes([IsAdmin])
def list_supplier_requests(request):
    """List all suppliers pending approval."""
    suppliers = services.list_pending_suppliers()
    return Response(UserSerializer(suppliers, many=True).data)


@api_view(['POST'])
@permission_classes([IsAdmin])
def approve_supplier(request, pk):
    supplier = services.approve_supplier(request.user, pk)
    return Response(UserSerializer(supplier).data)


@api_view(['POST'])
@permission_classes([IsAdmin])
def reject_supplier(request, pk):
    supplier = services.reject_supplier(request.user, pk)
    return Response(UserSerializer(supplier).data)


# ── Category ViewSet ──────────────────────────────────────────────────────────

class CategoryViewSet(viewsets.ModelViewSet):
    """
    CRUD for supply categories.
    GET  /api/auth/categories/           → any authenticated user
    POST /api/auth/categories/           → admin only
    PATCH/DELETE /api/auth/categories/:id/ → admin only
    """
    serializer_class = CategorySerializer
    queryset = Category.objects.all()

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsAdmin()]


# ── Supplier ViewSet ──────────────────────────────────────────────────────────

class SupplierViewSet(viewsets.ReadOnlyModelViewSet):
    """
    List and retrieve suppliers with their profiles.
    Admin sees all; supplier sees only themselves.
    GET  /api/auth/suppliers-v2/         → list
    GET  /api/auth/suppliers-v2/:id/     → detail
    POST /api/auth/suppliers-v2/:id/approve/ → admin
    POST /api/auth/suppliers-v2/:id/reject/  → admin
    PATCH /api/auth/suppliers-v2/:id/profile/ → admin or self
    """
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = User.objects.filter(role=User.Role.SUPPLIER).select_related('supplier_profile')
        user = self.request.user
        if user.role == User.Role.SUPPLIER:
            qs = qs.filter(pk=user.pk)
        return qs

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def approve(self, request, pk=None):
        supplier = services.approve_supplier(request.user, pk)
        return Response(SupplierSerializer(supplier).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def reject(self, request, pk=None):
        supplier = services.reject_supplier(request.user, pk)
        return Response(SupplierSerializer(supplier).data)

    @action(detail=True, methods=['get', 'patch'], url_path='profile')
    def profile(self, request, pk=None):
        supplier = self.get_object()

        # Only admin or the supplier themselves can access the profile
        if request.user.role != User.Role.ADMIN and request.user.pk != supplier.pk:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        profile, _ = SupplierProfile.objects.get_or_create(user=supplier)

        if request.method == 'GET':
            return Response(SupplierProfileSerializer(profile).data)

        ser = SupplierProfileSerializer(profile, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


# ── Buyer ViewSet ─────────────────────────────────────────────────────────────

class BuyerViewSet(viewsets.ReadOnlyModelViewSet):
    """
    List and retrieve buyers with their profiles.
    Admin sees all; buyer sees only themselves.
    GET  /api/auth/buyers/            → list
    GET  /api/auth/buyers/:id/        → detail
    PATCH /api/auth/buyers/:id/profile/ → admin or self
    """
    serializer_class = BuyerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = User.objects.filter(
            role__in=[User.Role.BUYER, User.Role.ADMIN]
        ).select_related('buyer_profile')
        user = self.request.user
        if user.role == User.Role.BUYER:
            qs = qs.filter(pk=user.pk)
        return qs

    @action(detail=True, methods=['get', 'patch'], url_path='profile')
    def profile(self, request, pk=None):
        buyer = self.get_object()

        if request.user.role != User.Role.ADMIN and request.user.pk != buyer.pk:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        profile, _ = BuyerProfile.objects.get_or_create(user=buyer)

        if request.method == 'GET':
            return Response(BuyerProfileSerializer(profile).data)

        ser = BuyerProfileSerializer(profile, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)
