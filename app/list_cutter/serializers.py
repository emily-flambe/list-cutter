from rest_framework import serializers
from .models import UserFile

class UserFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserFile
        fields = ['id', 'file', 'uploaded_at'] 