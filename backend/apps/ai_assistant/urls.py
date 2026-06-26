from django.urls import path
from . import views

urlpatterns = [
    path('chat/', views.chat, name='ai_chat'),
    path('confirm-request/', views.confirm_create_request, name='ai_confirm_request'),
    path('agent/', views.agent_chat, name='ai_agent'),
    path('supplier/chat/', views.supplier_chat, name='ai_supplier_chat'),
    path('supplier/suggestions/', views.supplier_suggestions, name='ai_supplier_suggestions'),
]
