# Root URL configuration
from adminplus.sites import AdminSitePlus
from django.contrib import admin
from django.urls import include, path
from config.views import homepage
from django.contrib.auth import views as django_auth_views
from django.conf import settings
from django.conf.urls.static import static



admin.site = AdminSitePlus()
admin.autodiscover()

urlpatterns = [
    path("", homepage, name="homepage"),
    path("admin/", admin.site.urls),
    path("api/", include("list_cutter.urls")),
]


urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)