from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.postgres.fields import ArrayField

User = get_user_model()

class Person(models.Model):
    # That's right, `cuttyid`
    cuttyid = models.IntegerField(primary_key=True, null=False, blank=False)
    # Associate record with the user who created it (tenant identifier)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='persons'
    )
    firstname = models.CharField(max_length=50, null=True, blank=True)
    middlename = models.CharField(max_length=50, null=True, blank=True)
    lastname = models.CharField(max_length=50, null=True, blank=True)
    dob = models.DateField(null=True, blank=True)
    sex = models.CharField(max_length=10, null=True, blank=True)
    version = models.CharField(max_length=20, null=True, blank=True)
    deceased = models.BooleanField(default=False)
    active = models.BooleanField(default=True)
    precinctname = models.CharField(max_length=100, null=True, blank=True)
    countyname = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    email = models.EmailField(null=True, blank=True)
    secondary_email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    secondary_phone = models.CharField(max_length=20, null=True, blank=True)
    mailing_address_line1 = models.CharField(max_length=255, null=True, blank=True)
    mailing_address_line2 = models.CharField(max_length=255, null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    statecode = models.CharField(max_length=10, null=True, blank=True)
    postal_code = models.CharField(max_length=20, null=True, blank=True)
    country = models.CharField(max_length=50, null=True, blank=True)
    # Additional Demographic & Audience Segmentation Fields
    race = models.CharField(max_length=50, null=True, blank=True)
    ethnicity = models.CharField(max_length=50, null=True, blank=True)
    income_range = models.CharField(max_length=50, null=True, blank=True)
    # Catchall "model scores" for, idk, model scores lol
    model_scores = models.JSONField(null=True, blank=True)
    # Tags and Notes for users to use if that sparks joy
    system_tags = models.ArrayField(models.CharField(max_length=255), null=True, blank=True)
    user_tags = models.ArrayField(models.CharField(max_length=255), null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"{self.firstname or ''} {self.lastname or ''}".strip()
