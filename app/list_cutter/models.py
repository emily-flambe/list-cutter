# app/list_cutter/models.py

from django.db import models
from django.contrib.auth.models import User
from django.contrib.postgres.fields import ArrayField

class SavedFile(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    file_id = models.CharField(max_length=255, unique=True)  # New field for file ID
    file_name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500, null=False, blank=False)  # Relative file path
    uploaded_at = models.DateTimeField(auto_now_add=True)
    system_tags = ArrayField(models.CharField(max_length=255), null=True, blank=True)
    user_tags = ArrayField(models.CharField(max_length=255), null=True, blank=True)
    metadata = models.JSONField(blank=True, null=True)

    def save(self, *args, **kwargs):
        '''
        Set file_name to the basename of file_path.
        '''
        if self.file_path:
            self.file_name = self.file_path.split('/')[-1]
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.file_name} uploaded by {self.user.username}"

    class Meta:
        db_table = 'list_cutter_savedfile'  # Explicitly set the table name

