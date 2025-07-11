#!/usr/bin/env python3
"""
Production Migration Playbook for Issue #66
===========================================

Complete production migration orchestration with comprehensive checklists,
procedures, and cutover management for zero-downtime Django to R2 migrations.

Features:
- Pre-migration validation and readiness assessment
- Step-by-step migration execution with checkpoints
- Real-time monitoring and progress tracking
- Automated rollback and disaster recovery
- Post-migration validation and optimization
- Comprehensive documentation and reporting
- Team coordination and communication
- Production cutover management

Author: Claude Code
Version: 1.0.0
"""

import asyncio
import json
import logging
import os
import sys
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone, timedelta
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Callable
import uuid
import subprocess

import click
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, MofNCompleteColumn
from rich.panel import Panel
from rich.tree import Tree
from rich.prompt import Confirm, Prompt, IntPrompt
from rich.live import Live
from rich.layout import Layout

# Import our migration modules
try:
    from production_migration_orchestrator import ProductionMigrationOrchestrator, MigrationConfig
    from migration_state_manager import MigrationStateManager, MigrationPhase, MigrationStatus
    from enhanced_migration_assessment import EnhancedMigrationAssessor
    from batch_migration_engine import BatchMigrationEngine
    from comprehensive_integrity_checker import ComprehensiveIntegrityChecker
    from disaster_recovery_procedures import DisasterRecoveryProcedures
except ImportError as e:
    console = Console()
    console.print(f"[red]Error importing migration modules: {e}[/red]")
    console.print("[yellow]Make sure all migration scripts are in the same directory[/yellow]")
    sys.exit(1)

console = Console()

class PlaybookPhase(Enum):
    """Migration playbook phases"""
    PREPARATION = "preparation"
    PRE_MIGRATION = "pre_migration"
    MIGRATION_EXECUTION = "migration_execution"
    POST_MIGRATION = "post_migration"
    CUTOVER = "cutover"
    VALIDATION = "validation"
    CLEANUP = "cleanup"
    COMPLETED = "completed"

class ChecklistStatus(Enum):
    """Checklist item status"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    NOT_APPLICABLE = "not_applicable"

class CriticalityLevel(Enum):
    """Task criticality levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class ChecklistItem:
    """Individual checklist item"""
    id: str
    title: str
    description: str
    phase: PlaybookPhase
    criticality: CriticalityLevel
    estimated_duration: int  # minutes
    
    # Status tracking
    status: ChecklistStatus = ChecklistStatus.PENDING
    assigned_to: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Dependencies
    depends_on: List[str] = field(default_factory=list)
    blocks: List[str] = field(default_factory=list)
    
    # Execution
    automated: bool = False
    command: Optional[str] = None
    validation_command: Optional[str] = None
    
    # Results
    result: Optional[str] = None
    error_message: Optional[str] = None
    artifacts: List[str] = field(default_factory=list)
    
    def __post_init__(self):
        if isinstance(self.started_at, str):
            self.started_at = datetime.fromisoformat(self.started_at)
        if isinstance(self.completed_at, str):
            self.completed_at = datetime.fromisoformat(self.completed_at)
    
    def start(self, assigned_to: str = "system"):
        """Start checklist item"""
        self.status = ChecklistStatus.IN_PROGRESS
        self.assigned_to = assigned_to
        self.started_at = datetime.now(timezone.utc)
    
    def complete(self, result: str = "", artifacts: List[str] = None):
        """Complete checklist item"""
        self.status = ChecklistStatus.COMPLETED
        self.completed_at = datetime.now(timezone.utc)
        self.result = result
        if artifacts:
            self.artifacts.extend(artifacts)
    
    def fail(self, error_message: str):
        """Mark checklist item as failed"""
        self.status = ChecklistStatus.FAILED
        self.completed_at = datetime.now(timezone.utc)
        self.error_message = error_message
    
    def duration_minutes(self) -> Optional[float]:
        """Get actual duration in minutes"""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds() / 60
        return None

@dataclass
class MigrationPlaybook:
    """Complete migration playbook"""
    id: str
    name: str
    description: str
    
    # Configuration
    config: Dict[str, Any] = field(default_factory=dict)
    
    # Phases and checklists
    checklist_items: List[ChecklistItem] = field(default_factory=list)
    current_phase: PlaybookPhase = PlaybookPhase.PREPARATION
    
    # Timing
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    estimated_duration: int = 0  # minutes
    
    # Team
    team_members: List[str] = field(default_factory=list)
    project_manager: Optional[str] = None
    technical_lead: Optional[str] = None
    
    # Status
    status: str = "draft"
    approval_required: bool = True
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    
    # Results
    success_rate: float = 0.0
    failed_items: List[str] = field(default_factory=list)
    
    def __post_init__(self):
        if isinstance(self.started_at, str):
            self.started_at = datetime.fromisoformat(self.started_at)
        if isinstance(self.completed_at, str):
            self.completed_at = datetime.fromisoformat(self.completed_at)
        if isinstance(self.approved_at, str):
            self.approved_at = datetime.fromisoformat(self.approved_at)
    
    def add_checklist_item(self, item: ChecklistItem):
        """Add checklist item"""
        self.checklist_items.append(item)
        self.estimated_duration += item.estimated_duration
    
    def get_phase_items(self, phase: PlaybookPhase) -> List[ChecklistItem]:
        """Get checklist items for specific phase"""
        return [item for item in self.checklist_items if item.phase == phase]
    
    def get_ready_items(self) -> List[ChecklistItem]:
        """Get items that are ready to execute (dependencies met)"""
        ready_items = []
        
        for item in self.checklist_items:
            if item.status != ChecklistStatus.PENDING:
                continue
            
            # Check if all dependencies are completed
            dependencies_met = all(
                any(dep_item.id == dep_id and dep_item.status == ChecklistStatus.COMPLETED 
                    for dep_item in self.checklist_items)
                for dep_id in item.depends_on
            )
            
            if not item.depends_on or dependencies_met:
                ready_items.append(item)
        
        return ready_items
    
    def calculate_progress(self) -> Dict[str, Any]:
        """Calculate overall progress"""
        total_items = len(self.checklist_items)
        if total_items == 0:
            return {'percentage': 0, 'completed': 0, 'total': 0}
        
        completed_items = sum(1 for item in self.checklist_items 
                            if item.status == ChecklistStatus.COMPLETED)
        failed_items = sum(1 for item in self.checklist_items 
                         if item.status == ChecklistStatus.FAILED)
        
        percentage = (completed_items / total_items) * 100
        
        return {
            'percentage': percentage,
            'completed': completed_items,
            'failed': failed_items,
            'total': total_items,
            'success_rate': (completed_items / (completed_items + failed_items)) * 100 if (completed_items + failed_items) > 0 else 0
        }

class PlaybookGenerator:
    """Generates migration playbooks"""
    
    def __init__(self):
        self.standard_checklists = self._load_standard_checklists()
    
    def _load_standard_checklists(self) -> Dict[PlaybookPhase, List[Dict[str, Any]]]:
        """Load standard checklist templates"""
        return {
            PlaybookPhase.PREPARATION: [
                {
                    'id': 'prep_001',
                    'title': 'Assemble Migration Team',
                    'description': 'Identify and assign team members for migration execution',
                    'criticality': CriticalityLevel.HIGH,
                    'estimated_duration': 30,
                    'automated': False
                },
                {
                    'id': 'prep_002',
                    'title': 'Review Migration Plan',
                    'description': 'Review and approve the complete migration plan',
                    'criticality': CriticalityLevel.CRITICAL,
                    'estimated_duration': 60,
                    'automated': False
                },
                {
                    'id': 'prep_003',
                    'title': 'Validate Infrastructure',
                    'description': 'Verify all infrastructure components are ready',
                    'criticality': CriticalityLevel.CRITICAL,
                    'estimated_duration': 45,
                    'automated': True,
                    'command': 'python scripts/validate_infrastructure.py'
                },
                {
                    'id': 'prep_004',
                    'title': 'Schedule Maintenance Window',
                    'description': 'Coordinate and confirm maintenance window with stakeholders',
                    'criticality': CriticalityLevel.HIGH,
                    'estimated_duration': 30,
                    'automated': False
                },
                {
                    'id': 'prep_005',
                    'title': 'Prepare Communication Plan',
                    'description': 'Prepare user and stakeholder communication materials',
                    'criticality': CriticalityLevel.MEDIUM,
                    'estimated_duration': 45,
                    'automated': False
                }
            ],
            PlaybookPhase.PRE_MIGRATION: [
                {
                    'id': 'pre_001',
                    'title': 'Run Enhanced Migration Assessment',
                    'description': 'Execute comprehensive file and migration assessment',
                    'criticality': CriticalityLevel.CRITICAL,
                    'estimated_duration': 120,
                    'automated': True,
                    'command': 'python scripts/enhanced_migration_assessment.py assess --media-root /path/to/media'
                },
                {
                    'id': 'pre_002',
                    'title': 'Create Complete System Backup',
                    'description': 'Create comprehensive backup of all systems and data',
                    'criticality': CriticalityLevel.CRITICAL,
                    'estimated_duration': 180,
                    'automated': True,
                    'command': 'python scripts/create_system_backup.py'
                },
                {
                    'id': 'pre_003',
                    'title': 'Validate Database Schema',
                    'description': 'Ensure D1 database schema is properly deployed',
                    'criticality': CriticalityLevel.CRITICAL,
                    'estimated_duration': 30,
                    'automated': True,
                    'command': 'python scripts/validate_database_schema.py'
                },
                {
                    'id': 'pre_004',
                    'title': 'Test R2 Storage Connectivity',
                    'description': 'Verify R2 storage is accessible and functional',
                    'criticality': CriticalityLevel.CRITICAL,
                    'estimated_duration': 15,
                    'automated': True,
                    'command': 'python scripts/test_r2_connectivity.py'
                },
                {
                    'id': 'pre_005',
                    'title': 'Initialize Migration State Tracking',
                    'description': 'Set up migration state management and monitoring',
                    'criticality': CriticalityLevel.HIGH,
                    'estimated_duration': 15,
                    'automated': True,
                    'command': 'python scripts/migration_state_manager.py init'
                },
                {
                    'id': 'pre_006',
                    'title': 'Run Pilot Migration Test',
                    'description': 'Execute small-scale pilot migration to validate process',
                    'criticality': CriticalityLevel.HIGH,
                    'estimated_duration': 60,
                    'automated': True,
                    'command': 'python scripts/run_pilot_migration.py'
                }
            ],
            PlaybookPhase.MIGRATION_EXECUTION: [
                {
                    'id': 'exec_001',
                    'title': 'Start Disaster Recovery Monitoring',
                    'description': 'Activate disaster recovery and failure detection systems',
                    'criticality': CriticalityLevel.CRITICAL,
                    'estimated_duration': 5,
                    'automated': True,
                    'command': 'python scripts/disaster_recovery_procedures.py monitor --config-file dr_config.json &'
                },
                {
                    'id': 'exec_002',
                    'title': 'Execute Production Migration',
                    'description': 'Run the main production migration using orchestrator',
                    'criticality': CriticalityLevel.CRITICAL,
                    'estimated_duration': 240,
                    'automated': True,
                    'command': 'python scripts/production_migration_orchestrator.py migrate',
                    'depends_on': ['exec_001']
                },
                {
                    'id': 'exec_003',
                    'title': 'Monitor Migration Progress',
                    'description': 'Continuously monitor migration progress and health',
                    'criticality': CriticalityLevel.HIGH,
                    'estimated_duration': 240,
                    'automated': True,
                    'command': 'python scripts/monitor_migration_progress.py',
                    'depends_on': ['exec_002']
                },
                {
                    'id': 'exec_004',
                    'title': 'Handle Migration Issues',
                    'description': 'Respond to and resolve any migration issues that arise',
                    'criticality': CriticalityLevel.HIGH,
                    'estimated_duration': 60,
                    'automated': False,
                    'depends_on': ['exec_002']
                }
            ],
            PlaybookPhase.POST_MIGRATION: [
                {
                    'id': 'post_001',
                    'title': 'Run Comprehensive Integrity Check',
                    'description': 'Verify all files were migrated correctly with integrity checks',
                    'criticality': CriticalityLevel.CRITICAL,
                    'estimated_duration': 90,
                    'automated': True,
                    'command': 'python scripts/comprehensive_integrity_checker.py verify migration_files.json'
                },
                {
                    'id': 'post_002',
                    'title': 'Validate Application Functionality',
                    'description': 'Test all application features to ensure they work with R2',
                    'criticality': CriticalityLevel.CRITICAL,
                    'estimated_duration': 120,
                    'automated': True,
                    'command': 'python scripts/validate_application_functionality.py'
                },
                {
                    'id': 'post_003',
                    'title': 'Performance Baseline Testing',
                    'description': 'Establish performance baselines with new R2 storage',
                    'criticality': CriticalityLevel.HIGH,
                    'estimated_duration': 60,
                    'automated': True,
                    'command': 'python scripts/performance_baseline_test.py'
                },
                {
                    'id': 'post_004',
                    'title': 'Update Monitoring and Alerts',
                    'description': 'Configure monitoring for R2 storage and update alerts',
                    'criticality': CriticalityLevel.HIGH,
                    'estimated_duration': 30,
                    'automated': False
                }
            ],
            PlaybookPhase.CUTOVER: [
                {
                    'id': 'cut_001',
                    'title': 'Execute Traffic Cutover',
                    'description': 'Switch production traffic to use R2 storage',
                    'criticality': CriticalityLevel.CRITICAL,
                    'estimated_duration': 15,
                    'automated': True,
                    'command': 'python scripts/execute_traffic_cutover.py'
                },
                {
                    'id': 'cut_002',
                    'title': 'Monitor Cutover Health',
                    'description': 'Monitor system health immediately after cutover',
                    'criticality': CriticalityLevel.CRITICAL,
                    'estimated_duration': 30,
                    'automated': True,
                    'command': 'python scripts/monitor_cutover_health.py',
                    'depends_on': ['cut_001']
                },
                {
                    'id': 'cut_003',
                    'title': 'Validate User Experience',
                    'description': 'Verify user-facing functionality works correctly',
                    'criticality': CriticalityLevel.HIGH,
                    'estimated_duration': 30,
                    'automated': False,
                    'depends_on': ['cut_001']
                }
            ],
            PlaybookPhase.VALIDATION: [
                {
                    'id': 'val_001',
                    'title': 'Run Full System Tests',
                    'description': 'Execute comprehensive system test suite',
                    'criticality': CriticalityLevel.CRITICAL,
                    'estimated_duration': 90,
                    'automated': True,
                    'command': 'python scripts/run_full_system_tests.py'
                },
                {
                    'id': 'val_002',
                    'title': 'Validate Data Consistency',
                    'description': 'Verify data consistency across all systems',
                    'criticality': CriticalityLevel.CRITICAL,
                    'estimated_duration': 60,
                    'automated': True,
                    'command': 'python scripts/validate_data_consistency.py'
                },
                {
                    'id': 'val_003',
                    'title': 'Performance Validation',
                    'description': 'Validate system performance meets requirements',
                    'criticality': CriticalityLevel.HIGH,
                    'estimated_duration': 45,
                    'automated': True,
                    'command': 'python scripts/validate_performance.py'
                },
                {
                    'id': 'val_004',
                    'title': 'Security Validation',
                    'description': 'Verify all security controls are functioning correctly',
                    'criticality': CriticalityLevel.HIGH,
                    'estimated_duration': 30,
                    'automated': True,
                    'command': 'python scripts/validate_security.py'
                }
            ],
            PlaybookPhase.CLEANUP: [
                {
                    'id': 'clean_001',
                    'title': 'Archive Old Files',
                    'description': 'Archive original files to long-term storage',
                    'criticality': CriticalityLevel.MEDIUM,
                    'estimated_duration': 60,
                    'automated': True,
                    'command': 'python scripts/archive_old_files.py'
                },
                {
                    'id': 'clean_002',
                    'title': 'Update Documentation',
                    'description': 'Update system documentation to reflect new architecture',
                    'criticality': CriticalityLevel.MEDIUM,
                    'estimated_duration': 120,
                    'automated': False
                },
                {
                    'id': 'clean_003',
                    'title': 'Team Debrief',
                    'description': 'Conduct post-migration team debrief and lessons learned',
                    'criticality': CriticalityLevel.LOW,
                    'estimated_duration': 60,
                    'automated': False
                },
                {
                    'id': 'clean_004',
                    'title': 'Final Migration Report',
                    'description': 'Generate comprehensive migration completion report',
                    'criticality': CriticalityLevel.MEDIUM,
                    'estimated_duration': 30,
                    'automated': True,
                    'command': 'python scripts/generate_migration_report.py'
                }
            ]
        }
    
    def generate_playbook(self, config: Dict[str, Any]) -> MigrationPlaybook:
        """Generate migration playbook from configuration"""
        playbook = MigrationPlaybook(
            id=str(uuid.uuid4()),
            name=config.get('name', 'Production Migration'),
            description=config.get('description', 'Django to R2 production migration'),
            config=config,
            team_members=config.get('team_members', []),
            project_manager=config.get('project_manager'),
            technical_lead=config.get('technical_lead')
        )
        
        # Add checklist items from templates
        for phase, items in self.standard_checklists.items():
            for item_config in items:
                item = ChecklistItem(
                    phase=phase,
                    **item_config
                )
                playbook.add_checklist_item(item)
        
        # Customize based on configuration
        self._customize_playbook(playbook, config)
        
        return playbook
    
    def _customize_playbook(self, playbook: MigrationPlaybook, config: Dict[str, Any]):
        """Customize playbook based on specific configuration"""
        # Add custom checklist items if specified
        custom_items = config.get('custom_checklist_items', [])
        for item_config in custom_items:
            item = ChecklistItem(**item_config)
            playbook.add_checklist_item(item)
        
        # Remove items based on configuration
        skip_items = config.get('skip_checklist_items', [])
        playbook.checklist_items = [
            item for item in playbook.checklist_items 
            if item.id not in skip_items
        ]
        
        # Update commands with actual paths
        media_root = config.get('django_media_root', '/app/media')
        for item in playbook.checklist_items:
            if item.command and '--media-root' in item.command:
                item.command = item.command.replace('/path/to/media', media_root)

class PlaybookExecutor:
    """Executes migration playbooks"""
    
    def __init__(self, playbook: MigrationPlaybook):
        self.playbook = playbook
        self.state_manager = MigrationStateManager()
        
        # Setup logging
        self.logger = self._setup_logging()
        
        # Initialize components
        self.orchestrator = None
        self.dr_system = None
        
    def _setup_logging(self) -> logging.Logger:
        """Setup logging configuration"""
        logger = logging.getLogger('playbook_executor')
        logger.setLevel(logging.INFO)
        
        log_dir = Path('logs')
        log_dir.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        log_file = log_dir / f'playbook_execution_{timestamp}.log'
        
        handler = logging.FileHandler(log_file)
        handler.setLevel(logging.INFO)
        
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        
        logger.addHandler(handler)
        
        return logger
    
    async def execute_playbook(self, interactive: bool = True) -> bool:
        """Execute the complete migration playbook"""
        console.print(f"[bold green]🚀 Starting Migration Playbook: {self.playbook.name}[/bold green]")
        
        self.playbook.started_at = datetime.now(timezone.utc)
        self.playbook.status = "executing"
        
        try:
            # Execute each phase
            phases = [
                PlaybookPhase.PREPARATION,
                PlaybookPhase.PRE_MIGRATION,
                PlaybookPhase.MIGRATION_EXECUTION,
                PlaybookPhase.POST_MIGRATION,
                PlaybookPhase.CUTOVER,
                PlaybookPhase.VALIDATION,
                PlaybookPhase.CLEANUP
            ]
            
            for phase in phases:
                success = await self._execute_phase(phase, interactive)
                if not success:
                    console.print(f"[red]❌ Phase {phase.value} failed[/red]")
                    return False
                
                self.playbook.current_phase = phase
            
            # Mark playbook as completed
            self.playbook.completed_at = datetime.now(timezone.utc)
            self.playbook.status = "completed"
            
            # Calculate final statistics
            progress = self.playbook.calculate_progress()
            self.playbook.success_rate = progress['success_rate']
            
            console.print("[bold green]✅ Migration Playbook Completed Successfully![/bold green]")
            return True
        
        except Exception as e:
            self.logger.error(f"Playbook execution failed: {e}")
            console.print(f"[red]❌ Playbook execution failed: {e}[/red]")
            return False
    
    async def _execute_phase(self, phase: PlaybookPhase, interactive: bool) -> bool:
        """Execute a specific migration phase"""
        phase_items = self.playbook.get_phase_items(phase)
        
        if not phase_items:
            console.print(f"[yellow]⚠️ No items found for phase: {phase.value}[/yellow]")
            return True
        
        console.print(f"\n[bold blue]📋 Executing Phase: {phase.value.replace('_', ' ').title()}[/bold blue]")
        
        # Display phase summary
        self._display_phase_summary(phase_items)
        
        # Get user confirmation for critical phases
        if interactive and phase in [PlaybookPhase.MIGRATION_EXECUTION, PlaybookPhase.CUTOVER]:
            if not Confirm.ask(f"Ready to proceed with {phase.value}?"):
                console.print("[yellow]Phase execution cancelled by user[/yellow]")
                return False
        
        # Execute items
        for item in phase_items:
            # Check dependencies
            if not self._check_dependencies(item):
                console.print(f"[red]Dependencies not met for {item.id}[/red]")
                return False
            
            # Execute item
            success = await self._execute_checklist_item(item, interactive)
            if not success and item.criticality in [CriticalityLevel.CRITICAL, CriticalityLevel.HIGH]:
                console.print(f"[red]Critical item {item.id} failed[/red]")
                return False
        
        return True
    
    def _display_phase_summary(self, items: List[ChecklistItem]):
        """Display phase summary"""
        table = Table(title="Phase Items")
        table.add_column("ID", style="cyan")
        table.add_column("Title", style="green")
        table.add_column("Criticality", style="yellow")
        table.add_column("Duration", style="blue")
        table.add_column("Automated", style="magenta")
        
        for item in items:
            table.add_row(
                item.id,
                item.title,
                item.criticality.value,
                f"{item.estimated_duration} min",
                "Yes" if item.automated else "No"
            )
        
        console.print(table)
    
    def _check_dependencies(self, item: ChecklistItem) -> bool:
        """Check if item dependencies are satisfied"""
        for dep_id in item.depends_on:
            dep_item = next((i for i in self.playbook.checklist_items if i.id == dep_id), None)
            if not dep_item or dep_item.status != ChecklistStatus.COMPLETED:
                return False
        return True
    
    async def _execute_checklist_item(self, item: ChecklistItem, interactive: bool) -> bool:
        """Execute a single checklist item"""
        console.print(f"\n[blue]🔄 Executing: {item.title}[/blue]")
        console.print(f"Description: {item.description}")
        
        item.start()
        
        try:
            if item.automated and item.command:
                # Execute automated command
                success = await self._execute_automated_item(item)
            else:
                # Manual execution
                success = await self._execute_manual_item(item, interactive)
            
            if success:
                item.complete()
                console.print(f"[green]✅ Completed: {item.title}[/green]")
            else:
                item.fail("Execution failed")
                console.print(f"[red]❌ Failed: {item.title}[/red]")
            
            return success
        
        except Exception as e:
            item.fail(str(e))
            console.print(f"[red]❌ Error executing {item.title}: {e}[/red]")
            return False
    
    async def _execute_automated_item(self, item: ChecklistItem) -> bool:
        """Execute automated checklist item"""
        try:
            console.print(f"[yellow]Running command: {item.command}[/yellow]")
            
            # Execute command
            process = await asyncio.create_subprocess_shell(
                item.command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                item.result = stdout.decode() if stdout else "Command completed successfully"
                return True
            else:
                item.error_message = stderr.decode() if stderr else f"Command failed with exit code {process.returncode}"
                return False
        
        except Exception as e:
            item.error_message = str(e)
            return False
    
    async def _execute_manual_item(self, item: ChecklistItem, interactive: bool) -> bool:
        """Execute manual checklist item"""
        if not interactive:
            # In non-interactive mode, assume manual items are completed externally
            return True
        
        console.print(f"[yellow]Manual task: {item.description}[/yellow]")
        
        # Show additional information if available
        if item.command:
            console.print(f"Suggested command: [dim]{item.command}[/dim]")
        
        # Wait for user confirmation
        completed = Confirm.ask("Has this task been completed?")
        
        if completed:
            result = Prompt.ask("Enter any notes or results (optional)", default="Completed manually")
            item.result = result
            return True
        else:
            # Allow user to skip non-critical items
            if item.criticality in [CriticalityLevel.LOW, CriticalityLevel.MEDIUM]:
                skip = Confirm.ask("Skip this non-critical task?")
                if skip:
                    item.status = ChecklistStatus.SKIPPED
                    return True
            
            return False
    
    def generate_progress_report(self) -> str:
        """Generate current progress report"""
        progress = self.playbook.calculate_progress()
        
        report = f"""
Migration Playbook Progress Report
=================================

Playbook: {self.playbook.name}
ID: {self.playbook.id}
Status: {self.playbook.status}
Current Phase: {self.playbook.current_phase.value}

Progress: {progress['percentage']:.1f}% ({progress['completed']}/{progress['total']} items)
Success Rate: {progress['success_rate']:.1f}%
Failed Items: {progress['failed']}

Timeline:
- Started: {self.playbook.started_at.strftime('%Y-%m-%d %H:%M:%S UTC') if self.playbook.started_at else 'Not started'}
- Current Time: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}
- Estimated Completion: {self.playbook.estimated_duration} minutes

Team:
- Project Manager: {self.playbook.project_manager or 'Not assigned'}
- Technical Lead: {self.playbook.technical_lead or 'Not assigned'}
- Team Members: {', '.join(self.playbook.team_members) if self.playbook.team_members else 'None assigned'}

Phase Breakdown:
"""
        
        for phase in PlaybookPhase:
            phase_items = self.playbook.get_phase_items(phase)
            if phase_items:
                completed = sum(1 for item in phase_items if item.status == ChecklistStatus.COMPLETED)
                total = len(phase_items)
                report += f"- {phase.value}: {completed}/{total} items completed\n"
        
        # Add failed items details
        failed_items = [item for item in self.playbook.checklist_items if item.status == ChecklistStatus.FAILED]
        if failed_items:
            report += "\nFailed Items:\n"
            for item in failed_items:
                report += f"- {item.id}: {item.title} - {item.error_message}\n"
        
        return report

# CLI Commands
@click.group()
@click.version_option(version="1.0.0")
def cli():
    """Production Migration Playbook CLI"""
    pass

@cli.command()
@click.option('--config-file', type=click.Path(exists=True), help='Playbook configuration file')
@click.option('--output-file', help='Output playbook file')
@click.option('--team-members', help='Comma-separated list of team members')
@click.option('--project-manager', help='Project manager name')
@click.option('--technical-lead', help='Technical lead name')
def generate(config_file, output_file, team_members, project_manager, technical_lead):
    """Generate migration playbook"""
    
    config = {}
    if config_file:
        with open(config_file, 'r') as f:
            config = json.load(f)
    
    # Override with CLI options
    if team_members:
        config['team_members'] = [member.strip() for member in team_members.split(',')]
    if project_manager:
        config['project_manager'] = project_manager
    if technical_lead:
        config['technical_lead'] = technical_lead
    
    # Generate playbook
    generator = PlaybookGenerator()
    playbook = generator.generate_playbook(config)
    
    # Save to file
    output_path = output_file or f"migration_playbook_{playbook.id}.json"
    with open(output_path, 'w') as f:
        json.dump(asdict(playbook), f, indent=2, default=str)
    
    console.print(f"[green]Playbook generated: {output_path}[/green]")
    
    # Display summary
    console.print(f"\nPlaybook Summary:")
    console.print(f"- Name: {playbook.name}")
    console.print(f"- ID: {playbook.id}")
    console.print(f"- Total Items: {len(playbook.checklist_items)}")
    console.print(f"- Estimated Duration: {playbook.estimated_duration} minutes")

@cli.command()
@click.argument('playbook_file', type=click.Path(exists=True))
@click.option('--interactive/--non-interactive', default=True, help='Interactive execution mode')
@click.option('--phase', type=click.Choice([p.value for p in PlaybookPhase]), help='Execute specific phase only')
def execute(playbook_file, interactive, phase):
    """Execute migration playbook"""
    
    # Load playbook
    with open(playbook_file, 'r') as f:
        playbook_data = json.load(f)
    
    # Create playbook object
    playbook = MigrationPlaybook(**playbook_data)
    
    # Create executor
    executor = PlaybookExecutor(playbook)
    
    try:
        if phase:
            # Execute specific phase
            target_phase = PlaybookPhase(phase)
            success = asyncio.run(executor._execute_phase(target_phase, interactive))
        else:
            # Execute full playbook
            success = asyncio.run(executor.execute_playbook(interactive))
        
        if success:
            console.print("[bold green]🎉 Playbook execution completed successfully![/bold green]")
            sys.exit(0)
        else:
            console.print("[bold red]💥 Playbook execution failed![/bold red]")
            sys.exit(1)
    
    except KeyboardInterrupt:
        console.print("[yellow]⏹️ Playbook execution interrupted[/yellow]")
        sys.exit(1)
    except Exception as e:
        console.print(f"[red]Fatal error: {e}[/red]")
        sys.exit(1)

@cli.command()
@click.argument('playbook_file', type=click.Path(exists=True))
@click.option('--output-file', help='Output report file')
def status(playbook_file, output_file):
    """Show playbook execution status"""
    
    # Load playbook
    with open(playbook_file, 'r') as f:
        playbook_data = json.load(f)
    
    playbook = MigrationPlaybook(**playbook_data)
    executor = PlaybookExecutor(playbook)
    
    # Generate progress report
    report = executor.generate_progress_report()
    
    if output_file:
        with open(output_file, 'w') as f:
            f.write(report)
        console.print(f"[green]Report saved to {output_file}[/green]")
    else:
        console.print(report)
    
    # Display progress visually
    progress = playbook.calculate_progress()
    
    console.print(f"\n[bold]Overall Progress: {progress['percentage']:.1f}%[/bold]")
    
    # Progress by phase
    table = Table(title="Phase Progress")
    table.add_column("Phase", style="cyan")
    table.add_column("Completed", style="green")
    table.add_column("Total", style="blue")
    table.add_column("Progress", style="yellow")
    
    for phase in PlaybookPhase:
        phase_items = playbook.get_phase_items(phase)
        if phase_items:
            completed = sum(1 for item in phase_items if item.status == ChecklistStatus.COMPLETED)
            total = len(phase_items)
            percentage = (completed / total) * 100
            
            table.add_row(
                phase.value,
                str(completed),
                str(total),
                f"{percentage:.1f}%"
            )
    
    console.print(table)

@cli.command()
@click.argument('playbook_file', type=click.Path(exists=True))
def validate(playbook_file):
    """Validate playbook configuration"""
    
    try:
        with open(playbook_file, 'r') as f:
            playbook_data = json.load(f)
        
        playbook = MigrationPlaybook(**playbook_data)
        
        # Validation checks
        issues = []
        
        # Check for required fields
        if not playbook.name:
            issues.append("Playbook name is required")
        
        if not playbook.checklist_items:
            issues.append("Playbook must have checklist items")
        
        # Check for dependency cycles
        for item in playbook.checklist_items:
            if item.id in item.depends_on:
                issues.append(f"Item {item.id} depends on itself")
        
        # Check for missing dependencies
        all_ids = {item.id for item in playbook.checklist_items}
        for item in playbook.checklist_items:
            for dep_id in item.depends_on:
                if dep_id not in all_ids:
                    issues.append(f"Item {item.id} depends on non-existent item {dep_id}")
        
        if issues:
            console.print("[red]Validation Issues Found:[/red]")
            for issue in issues:
                console.print(f"  • {issue}")
            sys.exit(1)
        else:
            console.print("[green]✅ Playbook validation passed[/green]")
            console.print(f"Playbook: {playbook.name}")
            console.print(f"Items: {len(playbook.checklist_items)}")
            console.print(f"Estimated Duration: {playbook.estimated_duration} minutes")
    
    except Exception as e:
        console.print(f"[red]Validation failed: {e}[/red]")
        sys.exit(1)

if __name__ == '__main__':
    cli()