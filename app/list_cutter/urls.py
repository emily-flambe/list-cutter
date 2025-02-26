from django.urls import path
from .views import list_cutter_home, upload_file_for_csv_cutter, export_csv

urlpatterns = [
    path("", list_cutter_home, name="list_cutter_home"),
    path("csv_cutter/", upload_file_for_csv_cutter, name="csv_cutter"),
    path("export_csv/", export_csv, name="export_csv"),
]

