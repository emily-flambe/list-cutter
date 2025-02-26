# accounts/urls.py
from django.urls import path
from .api_views import RegisterAPIView, UserAPIView
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    
)

urlpatterns = [
    path('register/', RegisterAPIView.as_view(), name='api-register'),
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('user/', UserAPIView.as_view(), name='user_api'),
]
