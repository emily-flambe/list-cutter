from django.urls import path
from .views import list_cutter_home, upload_file_for_csv_cutter, export_csv, upload_file, list_saved_files, download_file, delete_file, save_generated_file, update_tags, fetch_saved_file

urlpatterns = [
    path("", list_cutter_home, name="list_cutter_home"),
    path("csv_cutter/", upload_file_for_csv_cutter, name="csv_cutter"),
    path("export_csv/", export_csv, name="export_csv"),
    path("upload/", upload_file, name="upload_file"),
    path("list_saved_files/", list_saved_files, name="list_saved_files"),
    path("download/<str:filename>/", download_file, name="download_file"),
    path("delete/<str:file_id>/", delete_file, name="delete_file"),
    path("save_generated_file/", save_generated_file, name="save_generated_file"),
    path("update_tags/<int:file_id>/", update_tags, name="update_tags"),
    path("fetch_saved_file/", fetch_saved_file, name="fetch_saved_file"),
]


