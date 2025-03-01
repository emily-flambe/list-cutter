from django.contrib import admin
from .models import Person

# Register your models here.

class PersonAdmin(admin.ModelAdmin):
    list_display = ('cuttyid', 'created_by', 'firstname', 'lastname', 'email', 'phone', 'created_at')
    search_fields = ('cuttyid', 'firstname', 'lastname', 'email', 'phone')
    list_filter = ('created_by','created_at',)

admin.site.register(Person, PersonAdmin)
