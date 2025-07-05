"""
URL configuration for Phase 4 D1-compatible views
Provides alternative endpoints that use the hybrid database service
"""

from django.urls import path
from .views_d1 import (
    list_cutter_home, 
    upload_file_for_csv_cutter, 
    export_csv, 
    upload_file, 
    list_saved_files, 
    download_file, 
    delete_file, 
    save_generated_file, 
    update_tags, 
    fetch_saved_file, 
    fetch_file_lineage,
    fetch_file_tree,
    phase4_health_check
)

# Phase 4 D1-compatible URL patterns
urlpatterns = [
    # Core functionality (D1-compatible)
    path("", list_cutter_home, name="list_cutter_home_d1"),
    path("csv_cutter/", upload_file_for_csv_cutter, name="csv_cutter_d1"),
    path("export_csv/", export_csv, name="export_csv_d1"),
    path("upload/", upload_file, name="upload_file_d1"),
    path("list_saved_files/", list_saved_files, name="list_saved_files_d1"),
    path("download/<str:filename>/", download_file, name="download_file_d1"),
    path("delete/<str:file_id>/", delete_file, name="delete_file_d1"),
    path("save_generated_file/", save_generated_file, name="save_generated_file_d1"),
    path("update_tags/<str:file_id>/", update_tags, name="update_tags_d1"),
    path("fetch_saved_file/<str:file_id>/", fetch_saved_file, name="fetch_saved_file_d1"),
    
    # File lineage and relationships (D1 or Neo4j via hybrid service)
    path("fetch_file_lineage/<str:file_id>/", fetch_file_lineage, name="fetch_file_lineage_d1"),
    path("fetch_file_tree/<str:file_id>/", fetch_file_tree, name="fetch_file_tree_d1"),
    
    # Phase 4 specific endpoints
    path("health/", phase4_health_check, name="phase4_health_check"),
]