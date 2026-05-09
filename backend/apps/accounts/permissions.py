from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


class IsBuyer(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ('buyer', 'admin')


class IsSupplier(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'supplier'


class IsAdminOrBuyer(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ('admin', 'buyer')


class IsAdminOrBuyerOrReadOnly(BasePermission):
    """Grants full access to admin/buyer; suppliers get read-only (GET/HEAD/OPTIONS)."""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.role in ('admin', 'buyer')


class IsApprovedSupplier(BasePermission):
    """Supplier whose account has been approved by an admin."""
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == 'supplier'
            and request.user.is_approved
        )
