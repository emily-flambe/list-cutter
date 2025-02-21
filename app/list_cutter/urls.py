from django.urls import path, include
from .views import list_cutter_home, upload_file

urlpatterns = [
    path("", list_cutter_home, name="list_cutter_home"),
    path("upload/", upload_file, name="upload_file"),
]

