from django.contrib import admin
from .models import DummyModel

@admin.register(DummyModel)
class DummyModelAdmin(admin.ModelAdmin):
    list_display = ('user_id', 'display_name')
    search_fields = ('user_id', 'display_name')
