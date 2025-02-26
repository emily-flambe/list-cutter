# app/list_cutter/models.py

from django.db import models
from django.contrib.auth.models import User

class UploadedFile(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)  # Associate files with users
    file_name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)  # Store relative file path
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.file_name} uploaded by {self.user.username}"

