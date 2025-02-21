import requests
from django.core.management.base import BaseCommand
from list_cutter.models import DummyModel
import random

class Command(BaseCommand):
    help = "Adds a dummy record to the database"

    def handle(self, *args, **options):

        try:
            # generate random user_id with 8 digits
            user_id = random.randint(10000000, 99999999)
            user, created = DummyModel.objects.update_or_create(
                user_id=user_id, defaults={"display_name": "Dummy User"}
            )

            if created:
                self.stdout.write(self.style.SUCCESS(f"New dummy record added with id {user_id}"))
            else:
                self.stdout.write(self.style.SUCCESS(f"User ID {user_id} updated."))

        except requests.exceptions.RequestException as e:
            self.stderr.write(self.style.ERROR(f"Error fetching player data: {e}"))
