"""
D1 Database Service for List Cutter Phase 4
Provides a service layer for interacting with Cloudflare D1 database
Replaces Django ORM with direct SQL queries optimized for SQLite/D1
"""

import json
import sqlite3
from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass
import os


@dataclass
class User:
    """User model for D1 database"""
    id: Optional[int] = None
    username: str = ""
    password: str = ""
    email: str = ""
    first_name: str = ""
    last_name: str = ""
    is_active: bool = True
    is_staff: bool = False
    is_superuser: bool = False
    last_login: Optional[str] = None
    date_joined: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'username': self.username,
            'password': self.password,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'is_active': 1 if self.is_active else 0,
            'is_staff': 1 if self.is_staff else 0,
            'is_superuser': 1 if self.is_superuser else 0,
            'last_login': self.last_login,
            'date_joined': self.date_joined
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'User':
        return cls(
            id=data.get('id'),
            username=data.get('username', ''),
            password=data.get('password', ''),
            email=data.get('email', ''),
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', ''),
            is_active=bool(data.get('is_active', 1)),
            is_staff=bool(data.get('is_staff', 0)),
            is_superuser=bool(data.get('is_superuser', 0)),
            last_login=data.get('last_login'),
            date_joined=data.get('date_joined')
        )


@dataclass
class SavedFile:
    """SavedFile model for D1 database"""
    id: Optional[int] = None
    user_id: int = 0
    file_id: str = ""
    file_name: str = ""
    file_path: str = ""
    uploaded_at: Optional[str] = None
    system_tags: List[str] = None
    user_tags: List[str] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.system_tags is None:
            self.system_tags = []
        if self.user_tags is None:
            self.user_tags = []
        if self.metadata is None:
            self.metadata = {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'user_id': self.user_id,
            'file_id': self.file_id,
            'file_name': self.file_name,
            'file_path': self.file_path,
            'uploaded_at': self.uploaded_at,
            'system_tags': json.dumps(self.system_tags),
            'user_tags': json.dumps(self.user_tags),
            'metadata': json.dumps(self.metadata)
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SavedFile':
        system_tags = data.get('system_tags', '[]')
        if isinstance(system_tags, str):
            system_tags = json.loads(system_tags)
        
        user_tags = data.get('user_tags', '[]')
        if isinstance(user_tags, str):
            user_tags = json.loads(user_tags)
        
        metadata = data.get('metadata', '{}')
        if isinstance(metadata, str):
            metadata = json.loads(metadata)
        
        return cls(
            id=data.get('id'),
            user_id=data.get('user_id', 0),
            file_id=data.get('file_id', ''),
            file_name=data.get('file_name', ''),
            file_path=data.get('file_path', ''),
            uploaded_at=data.get('uploaded_at'),
            system_tags=system_tags,
            user_tags=user_tags,
            metadata=metadata
        )


@dataclass
class Person:
    """Person model for D1 database"""
    cuttyid: Optional[int] = None
    created_by_id: Optional[int] = None
    firstname: str = ""
    middlename: str = ""
    lastname: str = ""
    dob: Optional[str] = None
    sex: str = ""
    version: str = ""
    deceased: bool = False
    active: bool = True
    precinctname: str = ""
    countyname: str = ""
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    email: str = ""
    secondary_email: str = ""
    phone: str = ""
    secondary_phone: str = ""
    mailing_address_line1: str = ""
    mailing_address_line2: str = ""
    city: str = ""
    statecode: str = ""
    postal_code: str = ""
    country: str = ""
    race: str = ""
    ethnicity: str = ""
    income_range: str = ""
    model_scores: Dict[str, Any] = None
    system_tags: List[str] = None
    user_tags: List[str] = None
    notes: str = ""

    def __post_init__(self):
        if self.model_scores is None:
            self.model_scores = {}
        if self.system_tags is None:
            self.system_tags = []
        if self.user_tags is None:
            self.user_tags = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            'cuttyid': self.cuttyid,
            'created_by_id': self.created_by_id,
            'firstname': self.firstname,
            'middlename': self.middlename,
            'lastname': self.lastname,
            'dob': self.dob,
            'sex': self.sex,
            'version': self.version,
            'deceased': 1 if self.deceased else 0,
            'active': 1 if self.active else 0,
            'precinctname': self.precinctname,
            'countyname': self.countyname,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'email': self.email,
            'secondary_email': self.secondary_email,
            'phone': self.phone,
            'secondary_phone': self.secondary_phone,
            'mailing_address_line1': self.mailing_address_line1,
            'mailing_address_line2': self.mailing_address_line2,
            'city': self.city,
            'statecode': self.statecode,
            'postal_code': self.postal_code,
            'country': self.country,
            'race': self.race,
            'ethnicity': self.ethnicity,
            'income_range': self.income_range,
            'model_scores': json.dumps(self.model_scores),
            'system_tags': json.dumps(self.system_tags),
            'user_tags': json.dumps(self.user_tags),
            'notes': self.notes
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Person':
        model_scores = data.get('model_scores', '{}')
        if isinstance(model_scores, str):
            model_scores = json.loads(model_scores)
        
        system_tags = data.get('system_tags', '[]')
        if isinstance(system_tags, str):
            system_tags = json.loads(system_tags)
        
        user_tags = data.get('user_tags', '[]')
        if isinstance(user_tags, str):
            user_tags = json.loads(user_tags)
        
        return cls(
            cuttyid=data.get('cuttyid'),
            created_by_id=data.get('created_by_id'),
            firstname=data.get('firstname', ''),
            middlename=data.get('middlename', ''),
            lastname=data.get('lastname', ''),
            dob=data.get('dob'),
            sex=data.get('sex', ''),
            version=data.get('version', ''),
            deceased=bool(data.get('deceased', 0)),
            active=bool(data.get('active', 1)),
            precinctname=data.get('precinctname', ''),
            countyname=data.get('countyname', ''),
            created_at=data.get('created_at'),
            updated_at=data.get('updated_at'),
            email=data.get('email', ''),
            secondary_email=data.get('secondary_email', ''),
            phone=data.get('phone', ''),
            secondary_phone=data.get('secondary_phone', ''),
            mailing_address_line1=data.get('mailing_address_line1', ''),
            mailing_address_line2=data.get('mailing_address_line2', ''),
            city=data.get('city', ''),
            statecode=data.get('statecode', ''),
            postal_code=data.get('postal_code', ''),
            country=data.get('country', ''),
            race=data.get('race', ''),
            ethnicity=data.get('ethnicity', ''),
            income_range=data.get('income_range', ''),
            model_scores=model_scores,
            system_tags=system_tags,
            user_tags=user_tags,
            notes=data.get('notes', '')
        )


@dataclass
class FileRelationship:
    """FileRelationship model for D1 database (replaces Neo4j)"""
    id: Optional[int] = None
    source_file_id: str = ""
    target_file_id: str = ""
    relationship_type: str = "CUT_FROM"
    created_at: Optional[str] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'source_file_id': self.source_file_id,
            'target_file_id': self.target_file_id,
            'relationship_type': self.relationship_type,
            'created_at': self.created_at,
            'metadata': json.dumps(self.metadata)
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'FileRelationship':
        metadata = data.get('metadata', '{}')
        if isinstance(metadata, str):
            metadata = json.loads(metadata)
        
        return cls(
            id=data.get('id'),
            source_file_id=data.get('source_file_id', ''),
            target_file_id=data.get('target_file_id', ''),
            relationship_type=data.get('relationship_type', 'CUT_FROM'),
            created_at=data.get('created_at'),
            metadata=metadata
        )


class D1DatabaseService:
    """
    Service class for interacting with D1 database
    Provides high-level methods for CRUD operations
    """
    
    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize D1 service
        For local development, use SQLite file
        For production, this will be replaced with Cloudflare D1 bindings
        """
        self.db_path = db_path or os.getenv('D1_LOCAL_PATH', '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite')
        self.connection = None
    
    def get_connection(self) -> sqlite3.Connection:
        """Get database connection (local SQLite for development)"""
        if self.connection is None:
            # For local development, find the actual sqlite file
            if '*' in self.db_path:
                import glob
                sqlite_files = glob.glob(self.db_path)
                if sqlite_files:
                    self.db_path = sqlite_files[0]
                else:
                    raise Exception("No SQLite database file found")
            
            self.connection = sqlite3.connect(self.db_path)
            self.connection.row_factory = sqlite3.Row
        return self.connection
    
    def execute_query(self, query: str, params: tuple = ()) -> List[Dict[str, Any]]:
        """Execute a SELECT query and return results"""
        conn = self.get_connection()
        cursor = conn.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    
    def execute_command(self, command: str, params: tuple = ()) -> int:
        """Execute an INSERT/UPDATE/DELETE command and return affected rows"""
        conn = self.get_connection()
        cursor = conn.execute(command, params)
        conn.commit()
        return cursor.rowcount
    
    def close(self):
        """Close database connection"""
        if self.connection:
            self.connection.close()
            self.connection = None
    
    # User operations
    def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID"""
        results = self.execute_query("SELECT * FROM users WHERE id = ?", (user_id,))
        return User.from_dict(results[0]) if results else None
    
    def get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username"""
        results = self.execute_query("SELECT * FROM users WHERE username = ?", (username,))
        return User.from_dict(results[0]) if results else None
    
    def create_user(self, user: User) -> int:
        """Create new user and return ID"""
        data = user.to_dict()
        del data['id']  # Remove ID for auto-increment
        
        columns = ', '.join(data.keys())
        placeholders = ', '.join(['?' for _ in data])
        values = tuple(data.values())
        
        query = f"INSERT INTO users ({columns}) VALUES ({placeholders})"
        self.execute_command(query, values)
        
        # Get the inserted ID
        result = self.execute_query("SELECT last_insert_rowid() as id")
        return result[0]['id']
    
    # SavedFile operations
    def get_saved_file_by_id(self, file_id: str) -> Optional[SavedFile]:
        """Get saved file by file_id"""
        results = self.execute_query("SELECT * FROM saved_files WHERE file_id = ?", (file_id,))
        return SavedFile.from_dict(results[0]) if results else None
    
    def get_saved_files_by_user(self, user_id: int, limit: int = 100, offset: int = 0) -> List[SavedFile]:
        """Get saved files for a user with pagination"""
        results = self.execute_query(
            "SELECT * FROM saved_files WHERE user_id = ? ORDER BY uploaded_at DESC LIMIT ? OFFSET ?",
            (user_id, limit, offset)
        )
        return [SavedFile.from_dict(row) for row in results]
    
    def create_saved_file(self, saved_file: SavedFile) -> int:
        """Create new saved file and return ID"""
        data = saved_file.to_dict()
        del data['id']  # Remove ID for auto-increment
        
        if not data['uploaded_at']:
            data['uploaded_at'] = datetime.now().isoformat()
        
        columns = ', '.join(data.keys())
        placeholders = ', '.join(['?' for _ in data])
        values = tuple(data.values())
        
        query = f"INSERT INTO saved_files ({columns}) VALUES ({placeholders})"
        self.execute_command(query, values)
        
        # Get the inserted ID
        result = self.execute_query("SELECT last_insert_rowid() as id")
        return result[0]['id']
    
    def delete_saved_file(self, file_id: str) -> bool:
        """Delete saved file by file_id"""
        affected = self.execute_command("DELETE FROM saved_files WHERE file_id = ?", (file_id,))
        return affected > 0
    
    # Person operations
    def get_person_by_cuttyid(self, cuttyid: int) -> Optional[Person]:
        """Get person by cuttyid"""
        results = self.execute_query("SELECT * FROM persons WHERE cuttyid = ?", (cuttyid,))
        return Person.from_dict(results[0]) if results else None
    
    def get_persons_by_user(self, user_id: int, limit: int = 100, offset: int = 0) -> List[Person]:
        """Get persons for a user with pagination"""
        results = self.execute_query(
            "SELECT * FROM persons WHERE created_by_id = ? AND active = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (user_id, limit, offset)
        )
        return [Person.from_dict(row) for row in results]
    
    def search_persons(self, user_id: int, search_term: str, limit: int = 100) -> List[Person]:
        """Search persons by name or email"""
        search_pattern = f"%{search_term}%"
        results = self.execute_query("""
            SELECT * FROM persons 
            WHERE created_by_id = ? AND active = 1 
            AND (firstname LIKE ? OR lastname LIKE ? OR email LIKE ?)
            ORDER BY lastname, firstname
            LIMIT ?
        """, (user_id, search_pattern, search_pattern, search_pattern, limit))
        return [Person.from_dict(row) for row in results]
    
    def create_person(self, person: Person) -> int:
        """Create new person and return cuttyid"""
        data = person.to_dict()
        
        if not data['created_at']:
            data['created_at'] = datetime.now().isoformat()
        if not data['updated_at']:
            data['updated_at'] = datetime.now().isoformat()
        
        columns = ', '.join(data.keys())
        placeholders = ', '.join(['?' for _ in data])
        values = tuple(data.values())
        
        query = f"INSERT INTO persons ({columns}) VALUES ({placeholders})"
        self.execute_command(query, values)
        
        return data['cuttyid']
    
    def update_person(self, cuttyid: int, updates: Dict[str, Any]) -> bool:
        """Update person record"""
        updates['updated_at'] = datetime.now().isoformat()
        
        set_clause = ', '.join([f"{k} = ?" for k in updates.keys()])
        values = tuple(updates.values()) + (cuttyid,)
        
        query = f"UPDATE persons SET {set_clause} WHERE cuttyid = ?"
        affected = self.execute_command(query, values)
        return affected > 0
    
    # File relationship operations (replaces Neo4j)
    def get_file_lineage(self, file_id: str) -> Dict[str, List[str]]:
        """Get file lineage (what this file was cut from and what was cut to)"""
        # Files this file was cut from
        cut_from = self.execute_query("""
            SELECT source_file_id FROM file_relationships 
            WHERE target_file_id = ? AND relationship_type = 'CUT_FROM'
        """, (file_id,))
        
        # Files that were cut from this file
        cut_to = self.execute_query("""
            SELECT target_file_id FROM file_relationships 
            WHERE source_file_id = ? AND relationship_type = 'CUT_FROM'
        """, (file_id,))
        
        return {
            'cut_from': [row['source_file_id'] for row in cut_from],
            'cut_to': [row['target_file_id'] for row in cut_to]
        }
    
    def create_file_relationship(self, source_file_id: str, target_file_id: str, 
                               relationship_type: str = 'CUT_FROM', metadata: Dict[str, Any] = None) -> int:
        """Create file relationship"""
        relationship = FileRelationship(
            source_file_id=source_file_id,
            target_file_id=target_file_id,
            relationship_type=relationship_type,
            created_at=datetime.now().isoformat(),
            metadata=metadata or {}
        )
        
        data = relationship.to_dict()
        del data['id']  # Remove ID for auto-increment
        
        columns = ', '.join(data.keys())
        placeholders = ', '.join(['?' for _ in data])
        values = tuple(data.values())
        
        query = f"INSERT INTO file_relationships ({columns}) VALUES ({placeholders})"
        self.execute_command(query, values)
        
        # Get the inserted ID
        result = self.execute_query("SELECT last_insert_rowid() as id")
        return result[0]['id']
    
    def get_file_relationship_tree(self, file_id: str, max_depth: int = 5) -> Dict[str, Any]:
        """Get complete file relationship tree (recursive lineage)"""
        def get_ancestors(current_id: str, depth: int = 0) -> List[str]:
            if depth >= max_depth:
                return []
            
            parents = self.execute_query("""
                SELECT source_file_id FROM file_relationships 
                WHERE target_file_id = ? AND relationship_type = 'CUT_FROM'
            """, (current_id,))
            
            ancestors = []
            for parent in parents:
                parent_id = parent['source_file_id']
                ancestors.append(parent_id)
                ancestors.extend(get_ancestors(parent_id, depth + 1))
            
            return ancestors
        
        def get_descendants(current_id: str, depth: int = 0) -> List[str]:
            if depth >= max_depth:
                return []
            
            children = self.execute_query("""
                SELECT target_file_id FROM file_relationships 
                WHERE source_file_id = ? AND relationship_type = 'CUT_FROM'
            """, (current_id,))
            
            descendants = []
            for child in children:
                child_id = child['target_file_id']
                descendants.append(child_id)
                descendants.extend(get_descendants(child_id, depth + 1))
            
            return descendants
        
        return {
            'file_id': file_id,
            'ancestors': get_ancestors(file_id),
            'descendants': get_descendants(file_id)
        }