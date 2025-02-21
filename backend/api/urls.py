from django.urls import path
from . import views

urlpatterns = [
    path('upload/', views.upload_csv, name='upload_csv'),
    path('filter/', views.filter_csv, name='filter_csv'),
]
