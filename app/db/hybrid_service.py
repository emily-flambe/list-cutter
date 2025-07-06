"""
Hybrid Database Service for List Cutter Phase 4
Provides a unified interface that can use either Django ORM or D1 database
Based on feature flags for gradual migration
"""

from typing import Dict, List, Optional, Any, Union
from django.conf import settings
from django.contrib.auth.models import User as DjangoUser
from django.contrib.auth import authenticate

from .d1_service import (
    D1DatabaseService, 
    User as D1User, 
    SavedFile as D1SavedFile, 
    Person as D1Person
)

# Import Django models
from list_cutter.models import SavedFile as DjangoSavedFile
from contacts.models import Person as DjangoPerson
from list_cutter.graph_models import SavedFileNode


class HybridDatabaseService:
    """
    Hybrid service that can use either Django ORM or D1 database
    Based on feature flags for gradual migration
    """
    
    def __init__(self):
        self.d1_service = D1DatabaseService() if settings.D1_DATABASE_CONFIG.get('use_d1') else None
        self.feature_flags = settings.PHASE_4_FEATURES
    
    def _use_d1_for_users(self) -> bool:
        return self.feature_flags.get('use_d1_for_users', False) and self.d1_service is not None
    
    def _use_d1_for_files(self) -> bool:
        return self.feature_flags.get('use_d1_for_files', False) and self.d1_service is not None
    
    def _use_d1_for_persons(self) -> bool:
        return self.feature_flags.get('use_d1_for_persons', False) and self.d1_service is not None
    
    def _use_d1_for_relationships(self) -> bool:
        return self.feature_flags.get('use_d1_for_relationships', False) and self.d1_service is not None
    
    # User operations
    def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Get user by ID - unified interface"""
        if self._use_d1_for_users():
            user = self.d1_service.get_user_by_id(user_id)
            return user.to_dict() if user else None
        else:
            try:
                user = DjangoUser.objects.get(id=user_id)
                return {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'is_active': user.is_active,
                    'is_staff': user.is_staff,
                    'is_superuser': user.is_superuser,
                    'last_login': user.last_login.isoformat() if user.last_login else None,
                    'date_joined': user.date_joined.isoformat() if user.date_joined else None
                }
            except DjangoUser.DoesNotExist:
                return None
    
    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """Get user by username - unified interface"""
        if self._use_d1_for_users():
            user = self.d1_service.get_user_by_username(username)
            return user.to_dict() if user else None
        else:
            try:
                user = DjangoUser.objects.get(username=username)
                return {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'is_active': user.is_active,
                    'is_staff': user.is_staff,
                    'is_superuser': user.is_superuser,
                    'last_login': user.last_login.isoformat() if user.last_login else None,
                    'date_joined': user.date_joined.isoformat() if user.date_joined else None
                }
            except DjangoUser.DoesNotExist:
                return None
    
    def authenticate_user(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        """Authenticate user - works with both systems"""
        if self._use_d1_for_users():
            # D1 authentication would need custom implementation
            # For now, fall back to Django auth
            user = authenticate(username=username, password=password)
            if user:
                return self.get_user_by_id(user.id)
            return None
        else:
            user = authenticate(username=username, password=password)
            if user:
                return self.get_user_by_id(user.id)
            return None
    
    # SavedFile operations
    def get_saved_file_by_id(self, file_id: str) -> Optional[Dict[str, Any]]:
        """Get saved file by file_id - unified interface"""
        if self._use_d1_for_files():
            saved_file = self.d1_service.get_saved_file_by_id(file_id)
            return saved_file.to_dict() if saved_file else None
        else:
            try:
                saved_file = DjangoSavedFile.objects.get(file_id=file_id)
                return {
                    'id': saved_file.id,
                    'user_id': saved_file.user.id,
                    'file_id': saved_file.file_id,
                    'file_name': saved_file.file_name,
                    'file_path': saved_file.file_path,
                    'uploaded_at': saved_file.uploaded_at.isoformat() if saved_file.uploaded_at else None,
                    'system_tags': saved_file.system_tags or [],
                    'user_tags': saved_file.user_tags or [],
                    'metadata': saved_file.metadata or {}
                }
            except DjangoSavedFile.DoesNotExist:
                return None
    
    def get_saved_files_by_user(self, user_id: int, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """Get saved files for a user with pagination"""
        if self._use_d1_for_files():
            saved_files = self.d1_service.get_saved_files_by_user(user_id, limit, offset)
            return [sf.to_dict() for sf in saved_files]
        else:
            saved_files = DjangoSavedFile.objects.filter(user_id=user_id)\
                .order_by('-uploaded_at')[offset:offset+limit]
            
            return [{
                'id': sf.id,
                'user_id': sf.user.id,
                'file_id': sf.file_id,
                'file_name': sf.file_name,
                'file_path': sf.file_path,
                'uploaded_at': sf.uploaded_at.isoformat() if sf.uploaded_at else None,
                'system_tags': sf.system_tags or [],
                'user_tags': sf.user_tags or [],
                'metadata': sf.metadata or {}
            } for sf in saved_files]
    
    def create_saved_file(self, user_id: int, file_id: str, file_name: str, 
                         file_path: str, system_tags: List[str] = None, 
                         user_tags: List[str] = None, metadata: Dict[str, Any] = None) -> int:
        """Create new saved file"""
        if self._use_d1_for_files():
            saved_file = D1SavedFile(
                user_id=user_id,
                file_id=file_id,
                file_name=file_name,
                file_path=file_path,
                system_tags=system_tags or [],
                user_tags=user_tags or [],
                metadata=metadata or {}
            )
            return self.d1_service.create_saved_file(saved_file)
        else:
            user = DjangoUser.objects.get(id=user_id)
            saved_file = DjangoSavedFile.objects.create(
                user=user,
                file_id=file_id,
                file_name=file_name,
                file_path=file_path,
                system_tags=system_tags or [],
                user_tags=user_tags or [],
                metadata=metadata or {}
            )
            return saved_file.id
    
    def delete_saved_file(self, file_id: str) -> bool:
        """Delete saved file by file_id"""
        if self._use_d1_for_files():
            return self.d1_service.delete_saved_file(file_id)
        else:
            try:
                saved_file = DjangoSavedFile.objects.get(file_id=file_id)
                saved_file.delete()
                return True
            except DjangoSavedFile.DoesNotExist:
                return False
    
    # Person operations
    def get_person_by_cuttyid(self, cuttyid: int) -> Optional[Dict[str, Any]]:
        """Get person by cuttyid - unified interface"""
        if self._use_d1_for_persons():
            person = self.d1_service.get_person_by_cuttyid(cuttyid)
            return person.to_dict() if person else None
        else:
            try:
                person = DjangoPerson.objects.get(cuttyid=cuttyid)
                return {
                    'cuttyid': person.cuttyid,
                    'created_by_id': person.created_by.id if person.created_by else None,
                    'firstname': person.firstname or '',
                    'middlename': person.middlename or '',
                    'lastname': person.lastname or '',
                    'dob': person.dob.isoformat() if person.dob else None,
                    'sex': person.sex or '',
                    'version': person.version or '',
                    'deceased': person.deceased,
                    'active': person.active,
                    'precinctname': person.precinctname or '',
                    'countyname': person.countyname or '',
                    'created_at': person.created_at.isoformat() if person.created_at else None,
                    'updated_at': person.updated_at.isoformat() if person.updated_at else None,
                    'email': person.email or '',
                    'secondary_email': person.secondary_email or '',
                    'phone': person.phone or '',
                    'secondary_phone': person.secondary_phone or '',
                    'mailing_address_line1': person.mailing_address_line1 or '',
                    'mailing_address_line2': person.mailing_address_line2 or '',
                    'city': person.city or '',
                    'statecode': person.statecode or '',
                    'postal_code': person.postal_code or '',
                    'country': person.country or '',
                    'race': person.race or '',
                    'ethnicity': person.ethnicity or '',
                    'income_range': person.income_range or '',
                    'model_scores': person.model_scores or {},
                    'system_tags': person.system_tags or [],
                    'user_tags': person.user_tags or [],
                    'notes': person.notes or ''
                }
            except DjangoPerson.DoesNotExist:
                return None
    
    def get_persons_by_user(self, user_id: int, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """Get persons for a user with pagination"""
        if self._use_d1_for_persons():
            persons = self.d1_service.get_persons_by_user(user_id, limit, offset)
            return [p.to_dict() for p in persons]
        else:
            persons = DjangoPerson.objects.filter(created_by_id=user_id, active=True)\
                .order_by('-created_at')[offset:offset+limit]
            
            return [self._django_person_to_dict(person) for person in persons]
    
    def search_persons(self, user_id: int, search_term: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Search persons by name or email"""
        if self._use_d1_for_persons():
            persons = self.d1_service.search_persons(user_id, search_term, limit)
            return [p.to_dict() for p in persons]
        else:
            from django.db.models import Q
            persons = DjangoPerson.objects.filter(
                Q(created_by_id=user_id) & Q(active=True) &
                (Q(firstname__icontains=search_term) | 
                 Q(lastname__icontains=search_term) |
                 Q(email__icontains=search_term))
            ).order_by('lastname', 'firstname')[:limit]
            
            return [self._django_person_to_dict(person) for person in persons]
    
    def _django_person_to_dict(self, person: DjangoPerson) -> Dict[str, Any]:
        """Convert Django Person to dict"""
        return {
            'cuttyid': person.cuttyid,
            'created_by_id': person.created_by.id if person.created_by else None,
            'firstname': person.firstname or '',
            'middlename': person.middlename or '',
            'lastname': person.lastname or '',
            'dob': person.dob.isoformat() if person.dob else None,
            'sex': person.sex or '',
            'version': person.version or '',
            'deceased': person.deceased,
            'active': person.active,
            'precinctname': person.precinctname or '',
            'countyname': person.countyname or '',
            'created_at': person.created_at.isoformat() if person.created_at else None,
            'updated_at': person.updated_at.isoformat() if person.updated_at else None,
            'email': person.email or '',
            'secondary_email': person.secondary_email or '',
            'phone': person.phone or '',
            'secondary_phone': person.secondary_phone or '',
            'mailing_address_line1': person.mailing_address_line1 or '',
            'mailing_address_line2': person.mailing_address_line2 or '',
            'city': person.city or '',
            'statecode': person.statecode or '',
            'postal_code': person.postal_code or '',
            'country': person.country or '',
            'race': person.race or '',
            'ethnicity': person.ethnicity or '',
            'income_range': person.income_range or '',
            'model_scores': person.model_scores or {},
            'system_tags': person.system_tags or [],
            'user_tags': person.user_tags or [],
            'notes': person.notes or ''
        }
    
    # File relationship operations
    def get_file_lineage(self, file_id: str) -> Dict[str, List[str]]:
        """Get file lineage - works with both Neo4j and D1"""
        if self._use_d1_for_relationships():
            return self.d1_service.get_file_lineage(file_id)
        else:
            # Use Neo4j
            try:
                node = SavedFileNode.nodes.get(file_id=file_id)
                
                cut_from = [rel.file_id for rel in node.CUT_FROM.all()]
                cut_to = [rel.file_id for rel in node.CUT_TO.all()]
                
                return {
                    'cut_from': cut_from,
                    'cut_to': cut_to
                }
            except SavedFileNode.DoesNotExist:
                return {'cut_from': [], 'cut_to': []}
    
    def create_file_relationship(self, source_file_id: str, target_file_id: str, 
                               relationship_type: str = 'CUT_FROM', metadata: Dict[str, Any] = None) -> Union[int, str]:
        """Create file relationship"""
        if self._use_d1_for_relationships():
            return self.d1_service.create_file_relationship(
                source_file_id, target_file_id, relationship_type, metadata
            )
        else:
            # Use Neo4j
            try:
                source_node = SavedFileNode.nodes.get(file_id=source_file_id)
                target_node = SavedFileNode.nodes.get(file_id=target_file_id)
                
                if relationship_type == 'CUT_FROM':
                    source_node.CUT_TO.connect(target_node)
                    target_node.CUT_FROM.connect(source_node)
                
                return f"{source_file_id}->{target_file_id}"
            except SavedFileNode.DoesNotExist:
                return None
    
    def get_file_relationship_tree(self, file_id: str, max_depth: int = 5) -> Dict[str, Any]:
        """Get complete file relationship tree"""
        if self._use_d1_for_relationships():
            return self.d1_service.get_file_relationship_tree(file_id, max_depth)
        else:
            # Simplified Neo4j implementation
            lineage = self.get_file_lineage(file_id)
            return {
                'file_id': file_id,
                'ancestors': lineage['cut_from'],
                'descendants': lineage['cut_to']
            }
    
    def close(self):
        """Close database connections"""
        if self.d1_service:
            self.d1_service.close()


# Global service instance
db_service = HybridDatabaseService()