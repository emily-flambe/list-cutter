from neomodel import StructuredNode, StringProperty, RelationshipFrom, RelationshipTo

class SavedFileNode(StructuredNode):
    # We'll store the relational SavedFile ID as a string.
    file_id = StringProperty(unique_index=True, required=True)
    file_name = StringProperty(required=True)
    file_path = StringProperty(required=True)
    metadata = StringProperty(required=True)

    # Relationship indicating that this file was created from another file.
    # If file B is derived from file A, then file B will have a "created_from" relationship to A.
    created_from = RelationshipFrom('SavedFileNode', 'CREATED_FROM')
    
    def __str__(self):
        return f"{self.file_name} ({self.file_path})"
