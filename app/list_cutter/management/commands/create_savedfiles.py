from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from list_cutter.models import SavedFile
from list_cutter.common.generate_data import create_saved_file_node
import random
import uuid

'''
Run this to create saved files and nodes with relationships. This is useful for testing.
Usage: python manage.py create_savedfiles
'''

class Command(BaseCommand):
    help = "Creates 10 SavedFile and SavedFileNode records with relationships."

    def handle(self, *args, **options):
        # Retrieve a user to associate with the SavedFiles
        user = User.objects.first()  # Assuming there's at least one user

        saved_files = []
        saved_file_nodes = []

        # Create 5 files in a linear relationship
        for i in range(5):
            # Create a SavedFile instance
            file_id = uuid.uuid4()
            saved_file = SavedFile.objects.create(
                user=user,
                file_name=f"file_{random.getrandbits(16):x}.csv",
                file_path=f"uploads/file_{random.getrandbits(16):x}.csv",
                file_id=file_id,  # Include the generated file_id
                metadata={"foo": "keke"}
            )
            saved_files.append(saved_file)

            # Create the corresponding SavedFileNode
            saved_file_node = create_saved_file_node(saved_file)
            saved_file_nodes.append(saved_file_node)

            # Create relationships between the nodes
            if i > 0:
                saved_file_nodes[i].CUT_FROM.connect(saved_file_nodes[i - 1])

        # Create two additional files derived from the first file (A)
        for j in range(2):
            additional_file = SavedFile.objects.create(
                user=user,
                file_name=f"file_{j}_{random.getrandbits(16):x}.csv",
                file_path=f"uploads/file_5_{j}_{random.getrandbits(16):x}.csv",
                metadata={"foo": "jiji"}
            )
            saved_files.append(additional_file)

            additional_file_node = create_saved_file_node(additional_file)
            saved_file_nodes.append(additional_file_node)

            # Connect additional files to the first file (A)
            additional_file_node.CUT_FROM.connect(saved_file_nodes[0])

        # Create relationships for one of the additional files to derive two more files
        for k in range(2):
            derived_file = SavedFile.objects.create(
                user=user,
                file_name=f"file_{k}_{random.getrandbits(16):x}.csv",
                file_path=f"uploads/file_6_{k}_{random.getrandbits(16):x}.csv",
                metadata={"foo": "baba"}
            )
            saved_files.append(derived_file)

            derived_file_node = create_saved_file_node(derived_file)
            saved_file_nodes.append(derived_file_node)

            # Connect derived files to one of the additional files
            saved_file_nodes[5].CUT_FROM.connect(derived_file_node)

        # Create one more file derived from one of the derived files
        final_file = SavedFile.objects.create(
            user=user,
            file_name=f"file_{random.getrandbits(16):x}.csv",
            file_path=f"uploads/file_7_{random.getrandbits(16):x}.csv",
            metadata={"foo": "me"}
        )
        saved_files.append(final_file)

        final_file_node = create_saved_file_node(final_file)
        saved_file_nodes.append(final_file_node)

        # Connect the final file to one of the derived files
        saved_file_nodes[6].CUT_FROM.connect(final_file_node)

        self.stdout.write(self.style.SUCCESS("Successfully created SavedFile and SavedFileNode records with specified relationships.")) 