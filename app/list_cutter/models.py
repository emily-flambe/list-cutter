# app/list_cutter/models.py
from django.db import models
from django.conf import settings


class DummyModel(models.Model):
    user_id = models.BigIntegerField(primary_key=True, unique=True)  # Primary key
    display_name = models.CharField(max_length=255, null=True, blank=True)

    def __str__(self):
        return f"{self.user_id}, {self.display_name}"