from django.contrib import admin
from django.contrib.auth.models import User
from django.contrib.auth.admin import UserAdmin

# Unregister the default User if it was registered already
try:
    admin.site.unregister(User)
except admin.sites.NotRegistered:
    pass

# Register it with the default UserAdmin configuration
admin.site.register(User, UserAdmin)