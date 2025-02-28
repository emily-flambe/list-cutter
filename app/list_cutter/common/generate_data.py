from list_cutter.models import SavedFile
from list_cutter.graph_models import SavedFileNode
import json
import random

def create_saved_file_node(saved_file, cut_to_node=None):
    """Creates a SavedFileNode from a SavedFile instance."""
    metadata = json.dumps(saved_file.metadata) if saved_file.metadata else '{}'
    saved_file_node = SavedFileNode(
        file_id=str(saved_file.pk),
        file_name=saved_file.file_name,
        file_path=saved_file.file_path,
        metadata=metadata
    )
    saved_file_node.save()
    
    # Connect CUT_TO relationship if provided
    if cut_to_node:
        saved_file_node.CUT_TO.connect(cut_to_node)
    
    return saved_file_node 