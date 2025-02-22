from django.urls import path
from .views import list_cutter_home, upload_file, export_csv

urlpatterns = [
    path("", list_cutter_home, name="list_cutter_home"),
    path("upload/", upload_file, name="upload_file"),
    path("export_csv/", export_csv, name="export_csv"),
]

