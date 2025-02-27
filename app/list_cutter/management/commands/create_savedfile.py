from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from list_cutter.models import SavedFile
from list_cutter.graph_models import SavedFileNode
import json

'''
python manage.py create_savedfile \
  --username "admin" \
  --file_path_a "uploads/source.csv" \
  --metadata_a '{"source": "experiment"}' \
  --file_path_b "uploads/derived.csv" \
  --metadata_b '{"derived": "processed"}'
'''

class Command(BaseCommand):
    help = "Creates two SavedFile records (and graph nodes) and links them with a derived relationship."

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            required=True,
            help="Username of the uploader."
        )
        parser.add_argument(
            '--file_path_a',
            type=str,
            required=True,
            help="Relative file path for file A (the source file)."
        )
        parser.add_argument(
            '--metadata_a',
            type=str,
            required=False,
            default='{}',
            help="Metadata as a JSON string for file A. Defaults to empty JSON."
        )
        parser.add_argument(
            '--file_path_b',
            type=str,
            required=True,
            help="Relative file path for file B (the derived file)."
        )
        parser.add_argument(
            '--metadata_b',
            type=str,
            required=False,
            default='{}',
            help="Metadata as a JSON string for file B. Defaults to empty JSON."
        )

    def handle(self, *args, **options):
        username = options['username']
        file_path_a = options['file_path_a']
        file_path_b = options['file_path_b']
        metadata_a_input = options['metadata_a']
        metadata_b_input = options['metadata_b']

        # Retrieve the user
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"User '{username}' does not exist."))
            return

        # Parse metadata JSON strings
        try:
            metadata_a = json.loads(metadata_a_input)
            metadata_b = json.loads(metadata_b_input)
        except json.JSONDecodeError:
            self.stdout.write(self.style.ERROR("Invalid JSON provided for metadata."))
            return

        # Create SavedFile A in the relational database
        saved_file_a = SavedFile.objects.create(
            user=user,
            file_path=file_path_a,
            metadata=metadata_a
        )
        file_id_a = str(saved_file_a.pk)

        # Create the corresponding Neo4j node for file A
        saved_file_node_a = SavedFileNode(
            file_id=file_id_a,
            file_name=saved_file_a.file_name,
            file_path=saved_file_a.file_path,
            metadata=json.dumps(metadata_a)
        )
        saved_file_node_a.save()

        # Create SavedFile B in the relational database
        saved_file_b = SavedFile.objects.create(
            user=user,
            file_path=file_path_b,
            metadata=metadata_b
        )
        file_id_b = str(saved_file_b.pk)

        # Create the corresponding Neo4j node for file B
        saved_file_node_b = SavedFileNode(
            file_id=file_id_b,
            file_name=saved_file_b.file_name,
            file_path=saved_file_b.file_path,
            metadata=json.dumps(metadata_b)
        )
        saved_file_node_b.save()

        # Create a relationship indicating that file B is derived from file A.
        saved_file_node_b.created_from.connect(saved_file_node_a)
        # Optionally, if you want to explicitly record the reverse, you might do:
        # saved_file_node_a.used_to_create.connect(saved_file_node_b)
        # However, in many designs a single directed relationship is sufficient.

        self.stdout.write(self.style.SUCCESS(
            f"Successfully created File A (ID: {file_id_a}) and File B (ID: {file_id_b}) with derived relationship."
        ))
