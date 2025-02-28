from list_cutter.models import SavedFile
from list_cutter.graph_models import SavedFileNode
import json

def create_saved_file_node(saved_file):
    """Creates a SavedFileNode from a SavedFile instance."""
    metadata = json.dumps(saved_file.metadata) if saved_file.metadata else '{}'
    saved_file_node = SavedFileNode(
        file_id=str(saved_file.pk),
        file_name=saved_file.file_name,
        file_path=saved_file.file_path,
        metadata=metadata
    )
    saved_file_node.save()
    return saved_file_node 