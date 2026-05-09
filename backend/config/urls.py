from django.urls import path, include

urlpatterns = [
    path('api/auth/', include('apps.accounts.urls')),
    path('api/workflows/', include('apps.workflows.urls')),
    path('api/procurement/', include('apps.procurement.urls')),
    path('api/ai/', include('apps.ai_assistant.urls')),
    path('api/negotiations/', include('apps.negotiation.urls')),
]
