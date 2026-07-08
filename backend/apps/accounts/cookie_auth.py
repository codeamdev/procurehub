"""
Autenticador JWT que lee el token desde la cookie httpOnly 'access_token'
en lugar del header Authorization.

Listado ANTES de JWTAuthentication en settings para que las peticiones
del navegador (con cookie) se autentiquen primero. Las peticiones con
header Authorization siguen funcionando vía JWTAuthentication (fallback).

SameSite=Lax en las cookies provee protección CSRF: el browser no envía
la cookie en peticiones cross-site POST/XHR, por lo que no se requiere
un token CSRF adicional.
"""
from rest_framework_simplejwt.authentication import JWTAuthentication


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        raw_token = request.COOKIES.get('access_token')
        if raw_token is None:
            return None  # sin cookie → el siguiente autenticador lo intenta
        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token
