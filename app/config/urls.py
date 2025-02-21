# Root URL configuration
from adminplus.sites import AdminSitePlus
from django.contrib import admin
from django.urls import include, path
from config.views import homepage
from django.contrib.auth import views as django_auth_views

admin.site = AdminSitePlus()
admin.autodiscover()

urlpatterns = [
    path("", homepage, name="homepage"),
    path("admin/", admin.site.urls),
    path("list-cutter/", include("list_cutter.urls")),
]
