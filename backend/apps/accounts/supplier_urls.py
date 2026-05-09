from django.urls import path
from . import views

urlpatterns = [
    path('', views.list_supplier_requests, name='supplier_list'),
    path('<int:pk>/approve/', views.approve_supplier, name='supplier_approve'),
    path('<int:pk>/reject/', views.reject_supplier, name='supplier_reject'),
]
