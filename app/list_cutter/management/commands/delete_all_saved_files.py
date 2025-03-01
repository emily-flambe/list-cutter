import os
import shutil
from django.core.management.base import BaseCommand
from neomodel import db
from list_cutter.models import SavedFile
from django.conf import settings

'''
This command is used to delete all saved files, database entries, and Neo4j nodes.
It is useful for cleaning up the database and media files when developing in local or dev.
Please, oh pretty please be careful about running this command in production.
'''

class Command(BaseCommand):
    help = 'Delete all saved files, database entries, and Neo4j nodes.'

    def handle(self, *args, **kwargs):
        self.delete_saved_files_data()
        self.delete_saved_file_nodes_data()
        self.delete_saved_files()

    def delete_saved_files_data(self):
        # Delete all SavedFile objects from PostgreSQL
        SavedFile.objects.all().delete()
        self.stdout.write(self.style.SUCCESS("All SavedFile objects deleted from PostgreSQL."))

    def delete_saved_file_nodes_data(self):
        # Delete all SavedFileNode objects from Neo4j
        query = "MATCH (n:SavedFileNode) DETACH DELETE n"
        db.cypher_query(query)
        self.stdout.write(self.style.SUCCESS("All SavedFileNode objects deleted from Neo4j."))

    def delete_saved_files(self):
        # Delete all files and folders within MEDIA_ROOT
        media_root = settings.MEDIA_ROOT
        for root, dirs, files in os.walk(media_root):
            for file in files:
                file_path = os.path.join(root, file)
                os.remove(file_path)
            for dir in dirs:
                dir_path = os.path.join(root, dir)
                shutil.rmtree(dir_path)
        self.stdout.write(self.style.SUCCESS(f"All files and folders deleted from MEDIA_ROOT: {media_root}.")) 