from django.contrib import admin
from django.contrib.auth.models import User
from .models import SavedFile

class SavedFileAdmin(admin.ModelAdmin):
    list_display = ('file_id', 'file_name', 'file_path', 'user', 'uploaded_at', 'system_tags', 'user_tags', 'metadata')
    search_fields = ('file_name', 'user__username')
    list_filter = ('uploaded_at',)
    ordering = ('-uploaded_at',)

admin.site.register(SavedFile, SavedFileAdmin)
