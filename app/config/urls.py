# Root URL configuration
from adminplus.sites import AdminSitePlus
from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static

admin.site = AdminSitePlus()
admin.autodiscover()

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/list_cutter/", include("list_cutter.urls")),
    path("api/accounts/", include("accounts.urls")),
    # Must be last to accomodate the SPA catchall
    path("", include("list_cutter.urls")),
]


urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)