from neomodel import StructuredNode, StringProperty, RelationshipFrom, RelationshipTo, JSONProperty

class SavedFileNode(StructuredNode):
    # We'll store the relational SavedFile ID as a string.
    file_id = StringProperty(unique_index=True, required=True)
    file_name = StringProperty(required=True)
    file_path = StringProperty(required=True)
    metadata = JSONProperty(required=True)

    # Relationships indicating that this file was cut from or to another file.
    CUT_FROM = RelationshipFrom('SavedFileNode', 'CUT_FROM')
    CUT_TO = RelationshipTo('SavedFileNode', 'CUT_TO')
    
    def __str__(self):
        return f"{self.file_name} ({self.file_path})"
