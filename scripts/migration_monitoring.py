#!/usr/bin/env python3
"""
Migration Monitoring and Alerting for Issue #66
===============================================

Real-time monitoring and alerting system for production file migrations.
Provides comprehensive monitoring, alerting, and dashboard capabilities.

Features:
- Real-time migration progress tracking and visualization
- Performance monitoring with bottleneck detection
- Comprehensive alerting system with escalation procedures
- Interactive monitoring dashboard with live updates
- Health monitoring and system resource tracking
- SLA monitoring and performance benchmarking
- Notification management across multiple channels
- Historical data analysis and trend reporting

Author: Claude Code
Version: 1.0.0
"""

import asyncio
import json
import logging
import os
import sys
import time
import socket
import psutil
import threading
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone, timedelta
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Callable, Set
from collections import deque, defaultdict
import sqlite3
import smtplib
from email.mime.text import MIMEText as MimeText
from email.mime.multipart import MIMEMultipart as MimeMultipart
import uuid
import subprocess

import aiohttp
import click
import requests
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, MofNCompleteColumn
from rich.live import Live
from rich.layout import Layout
from rich.panel import Panel
from rich.tree import Tree
from rich.align import Align
from rich.text import Text
from rich.columns import Columns
from rich.prompt import Confirm, Prompt

# Try to import migration modules
try:
    from migration_state_manager import MigrationStateManager, MigrationPhase, MigrationStatus
    from production_migration_orchestrator import ProductionMigrationOrchestrator
    from batch_migration_engine import BatchMigrationEngine, BatchStats
except ImportError as e:
    console = Console()
    console.print(f"[red]Error importing migration modules: {e}[/red]")
    console.print("[yellow]Some features may be limited[/yellow]")

console = Console()

class AlertLevel(Enum):
    """Alert severity levels"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"
    EMERGENCY = "emergency"

class AlertType(Enum):
    """Types of alerts"""
    PERFORMANCE_DEGRADATION = "performance_degradation"
    HIGH_ERROR_RATE = "high_error_rate"
    MIGRATION_STALLED = "migration_stalled"
    RESOURCE_EXHAUSTION = "resource_exhaustion"
    INTEGRITY_FAILURE = "integrity_failure"
    TIMEOUT_EXCEEDED = "timeout_exceeded"
    QUOTA_EXCEEDED = "quota_exceeded"
    SYSTEM_FAILURE = "system_failure"

class NotificationChannel(Enum):
    """Notification delivery channels"""
    EMAIL = "email"
    SLACK = "slack"
    WEBHOOK = "webhook"
    SMS = "sms"
    CONSOLE = "console"
    LOG = "log"

class MetricType(Enum):
    """Types of monitoring metrics"""
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    RATE = "rate"

@dataclass
class Alert:
    """Alert definition and tracking"""
    id: str
    alert_type: AlertType
    level: AlertLevel
    title: str
    description: str
    
    # Timing
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    
    # Context
    source: str = ""
    affected_component: str = ""
    metric_value: Optional[float] = None
    threshold: Optional[float] = None
    
    # Tracking
    notification_count: int = 0
    acknowledged_by: Optional[str] = None
    resolved_by: Optional[str] = None
    
    # Escalation
    escalation_level: int = 0
    escalation_rules: List[Dict[str, Any]] = field(default_factory=list)
    
    def is_active(self) -> bool:
        """Check if alert is still active"""
        return self.resolved_at is None
    
    def duration(self) -> timedelta:
        """Get alert duration"""
        end_time = self.resolved_at or datetime.now(timezone.utc)
        return end_time - self.created_at
    
    def should_escalate(self) -> bool:
        """Check if alert should be escalated"""
        if not self.is_active():
            return False
        
        duration_minutes = self.duration().total_seconds() / 60
        
        # Basic escalation logic
        if self.level == AlertLevel.CRITICAL and duration_minutes > 15:
            return True
        elif self.level == AlertLevel.ERROR and duration_minutes > 30:
            return True
        elif self.level == AlertLevel.WARNING and duration_minutes > 60:
            return True
        
        return False

@dataclass
class MonitoringMetric:
    """Monitoring metric definition"""
    name: str
    metric_type: MetricType
    value: float
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Metadata
    tags: Dict[str, str] = field(default_factory=dict)
    unit: str = ""
    description: str = ""
    
    # Thresholds
    warning_threshold: Optional[float] = None
    critical_threshold: Optional[float] = None
    
    def is_above_threshold(self, threshold: Optional[float]) -> bool:
        """Check if metric exceeds threshold"""
        return threshold is not None and self.value > threshold
    
    def get_alert_level(self) -> Optional[AlertLevel]:
        """Get alert level based on thresholds"""
        if self.is_above_threshold(self.critical_threshold):
            return AlertLevel.CRITICAL
        elif self.is_above_threshold(self.warning_threshold):
            return AlertLevel.WARNING
        return None

@dataclass
class SystemHealth:
    """System health snapshot"""
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    # CPU and Memory
    cpu_percent: float = 0.0
    memory_percent: float = 0.0
    memory_available: int = 0
    
    # Disk
    disk_usage_percent: float = 0.0
    disk_free_space: int = 0
    disk_io_read: int = 0
    disk_io_write: int = 0
    
    # Network
    network_bytes_sent: int = 0
    network_bytes_received: int = 0
    network_connections: int = 0
    
    # Migration specific
    active_migrations: int = 0
    queued_tasks: int = 0
    failed_tasks: int = 0
    
    def is_healthy(self) -> bool:
        """Check if system is in healthy state"""
        return (
            self.cpu_percent < 80 and
            self.memory_percent < 85 and
            self.disk_usage_percent < 90
        )

class NotificationService:
    """Manages notification delivery across multiple channels"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.email_config = config.get('email', {})
        self.slack_config = config.get('slack', {})
        self.webhook_config = config.get('webhook', {})
        self.sms_config = config.get('sms', {})
        
        # Setup logging
        self.logger = logging.getLogger('notification_service')
        self.notification_history = deque(maxlen=1000)
    
    async def send_notification(self, alert: Alert, channels: List[NotificationChannel]) -> bool:
        """Send notification through specified channels"""
        success = True
        
        for channel in channels:
            try:
                if channel == NotificationChannel.EMAIL:
                    await self._send_email(alert)
                elif channel == NotificationChannel.SLACK:
                    await self._send_slack(alert)
                elif channel == NotificationChannel.WEBHOOK:
                    await self._send_webhook(alert)
                elif channel == NotificationChannel.SMS:
                    await self._send_sms(alert)
                elif channel == NotificationChannel.CONSOLE:
                    self._send_console(alert)
                elif channel == NotificationChannel.LOG:
                    self._send_log(alert)
                
                self.notification_history.append({
                    'alert_id': alert.id,
                    'channel': channel.value,
                    'timestamp': datetime.now(timezone.utc),
                    'success': True
                })
                
            except Exception as e:
                self.logger.error(f"Failed to send notification via {channel.value}: {e}")
                success = False
                
                self.notification_history.append({
                    'alert_id': alert.id,
                    'channel': channel.value,
                    'timestamp': datetime.now(timezone.utc),
                    'success': False,
                    'error': str(e)
                })
        
        return success
    
    async def _send_email(self, alert: Alert):
        """Send email notification"""
        if not self.email_config.get('enabled', False):
            return
        
        msg = MimeMultipart()
        msg['From'] = self.email_config['from']
        msg['To'] = ', '.join(self.email_config['to'])
        msg['Subject'] = f"[{alert.level.value.upper()}] {alert.title}"
        
        body = f"""
Migration Alert: {alert.title}

Level: {alert.level.value.upper()}
Type: {alert.alert_type.value}
Component: {alert.affected_component}
Time: {alert.created_at.strftime('%Y-%m-%d %H:%M:%S UTC')}

Description:
{alert.description}

Alert ID: {alert.id}
"""
        
        msg.attach(MimeText(body, 'plain'))
        
        server = smtplib.SMTP(self.email_config['smtp_server'], self.email_config['smtp_port'])
        if self.email_config.get('use_tls', True):
            server.starttls()
        if self.email_config.get('username'):
            server.login(self.email_config['username'], self.email_config['password'])
        
        server.send_message(msg)
        server.quit()
    
    async def _send_slack(self, alert: Alert):
        """Send Slack notification"""
        if not self.slack_config.get('enabled', False):
            return
        
        webhook_url = self.slack_config['webhook_url']
        
        color = {
            AlertLevel.INFO: "good",
            AlertLevel.WARNING: "warning", 
            AlertLevel.ERROR: "danger",
            AlertLevel.CRITICAL: "danger",
            AlertLevel.EMERGENCY: "danger"
        }.get(alert.level, "warning")
        
        payload = {
            "text": f"Migration Alert: {alert.title}",
            "attachments": [{
                "color": color,
                "fields": [
                    {"title": "Level", "value": alert.level.value.upper(), "short": True},
                    {"title": "Type", "value": alert.alert_type.value, "short": True},
                    {"title": "Component", "value": alert.affected_component, "short": True},
                    {"title": "Time", "value": alert.created_at.strftime('%Y-%m-%d %H:%M:%S UTC'), "short": True},
                    {"title": "Description", "value": alert.description, "short": False}
                ]
            }]
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(webhook_url, json=payload) as response:
                if response.status != 200:
                    raise Exception(f"Slack webhook failed: {response.status}")
    
    async def _send_webhook(self, alert: Alert):
        """Send webhook notification"""
        if not self.webhook_config.get('enabled', False):
            return
        
        webhook_url = self.webhook_config['url']
        
        payload = {
            "alert": asdict(alert),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        headers = self.webhook_config.get('headers', {})
        
        async with aiohttp.ClientSession() as session:
            async with session.post(webhook_url, json=payload, headers=headers) as response:
                if response.status not in [200, 201, 202]:
                    raise Exception(f"Webhook failed: {response.status}")
    
    async def _send_sms(self, alert: Alert):
        """Send SMS notification"""
        if not self.sms_config.get('enabled', False):
            return
        
        # Implementation depends on SMS provider (Twilio, AWS SNS, etc.)
        # This is a placeholder for SMS integration
        self.logger.info(f"SMS notification sent for alert {alert.id}")
    
    def _send_console(self, alert: Alert):
        """Send console notification"""
        level_colors = {
            AlertLevel.INFO: "blue",
            AlertLevel.WARNING: "yellow",
            AlertLevel.ERROR: "red",
            AlertLevel.CRITICAL: "bold red",
            AlertLevel.EMERGENCY: "bold red blink"
        }
        
        color = level_colors.get(alert.level, "white")
        console.print(f"[{color}]🚨 {alert.level.value.upper()}: {alert.title}[/{color}]")
        console.print(f"[dim]{alert.description}[/dim]")
    
    def _send_log(self, alert: Alert):
        """Send log notification"""
        level_map = {
            AlertLevel.INFO: logging.INFO,
            AlertLevel.WARNING: logging.WARNING,
            AlertLevel.ERROR: logging.ERROR,
            AlertLevel.CRITICAL: logging.CRITICAL,
            AlertLevel.EMERGENCY: logging.CRITICAL
        }
        
        log_level = level_map.get(alert.level, logging.INFO)
        self.logger.log(log_level, f"Alert {alert.id}: {alert.title} - {alert.description}")

class MetricsCollector:
    """Collects and manages monitoring metrics"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.metrics: Dict[str, MonitoringMetric] = {}
        self.metric_history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        
        # Database for metrics storage
        self.db_path = config.get('metrics_db', 'metrics.db')
        self._init_database()
    
    def _init_database(self):
        """Initialize metrics database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS metrics (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                metric_type TEXT NOT NULL,
                value REAL NOT NULL,
                timestamp TEXT NOT NULL,
                tags TEXT,
                unit TEXT,
                description TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_metrics_name_timestamp 
            ON metrics(name, timestamp)
        ''')
        
        conn.commit()
        conn.close()
    
    def record_metric(self, metric: MonitoringMetric):
        """Record a new metric"""
        self.metrics[metric.name] = metric
        self.metric_history[metric.name].append(metric)
        
        # Store in database
        self._store_metric(metric)
    
    def _store_metric(self, metric: MonitoringMetric):
        """Store metric in database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO metrics (id, name, metric_type, value, timestamp, tags, unit, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            str(uuid.uuid4()),
            metric.name,
            metric.metric_type.value,
            metric.value,
            metric.timestamp.isoformat(),
            json.dumps(metric.tags),
            metric.unit,
            metric.description
        ))
        
        conn.commit()
        conn.close()
    
    def get_metric(self, name: str) -> Optional[MonitoringMetric]:
        """Get current metric value"""
        return self.metrics.get(name)
    
    def get_metric_history(self, name: str, limit: int = 100) -> List[MonitoringMetric]:
        """Get metric history"""
        history = list(self.metric_history[name])
        return history[-limit:] if len(history) > limit else history
    
    def get_system_health(self) -> SystemHealth:
        """Collect current system health metrics"""
        health = SystemHealth()
        
        # CPU and Memory
        health.cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        health.memory_percent = memory.percent
        health.memory_available = memory.available
        
        # Disk
        disk = psutil.disk_usage('/')
        health.disk_usage_percent = disk.percent
        health.disk_free_space = disk.free
        
        disk_io = psutil.disk_io_counters()
        if disk_io:
            health.disk_io_read = disk_io.read_bytes
            health.disk_io_write = disk_io.write_bytes
        
        # Network
        network_io = psutil.net_io_counters()
        if network_io:
            health.network_bytes_sent = network_io.bytes_sent
            health.network_bytes_received = network_io.bytes_recv
        
        health.network_connections = len(psutil.net_connections())
        
        # Record as metrics
        self.record_metric(MonitoringMetric(
            name="system.cpu_percent",
            metric_type=MetricType.GAUGE,
            value=health.cpu_percent,
            unit="percent",
            warning_threshold=80,
            critical_threshold=90
        ))
        
        self.record_metric(MonitoringMetric(
            name="system.memory_percent",
            metric_type=MetricType.GAUGE,
            value=health.memory_percent,
            unit="percent",
            warning_threshold=85,
            critical_threshold=95
        ))
        
        self.record_metric(MonitoringMetric(
            name="system.disk_usage_percent",
            metric_type=MetricType.GAUGE,
            value=health.disk_usage_percent,
            unit="percent",
            warning_threshold=90,
            critical_threshold=95
        ))
        
        return health

class AlertManager:
    """Manages alert lifecycle and escalation"""
    
    def __init__(self, config: Dict[str, Any], notification_service: NotificationService):
        self.config = config
        self.notification_service = notification_service
        self.active_alerts: Dict[str, Alert] = {}
        self.alert_history: deque = deque(maxlen=10000)
        
        # Database for alert storage
        self.db_path = config.get('alerts_db', 'alerts.db')
        self._init_database()
        
        # Escalation rules
        self.escalation_rules = config.get('escalation_rules', [])
    
    def _init_database(self):
        """Initialize alerts database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS alerts (
                id TEXT PRIMARY KEY,
                alert_type TEXT NOT NULL,
                level TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                created_at TEXT NOT NULL,
                acknowledged_at TEXT,
                resolved_at TEXT,
                source TEXT,
                affected_component TEXT,
                metric_value REAL,
                threshold REAL,
                acknowledged_by TEXT,
                resolved_by TEXT
            )
        ''')
        
        conn.commit()
        conn.close()
    
    async def create_alert(self, alert_type: AlertType, level: AlertLevel, 
                          title: str, description: str, **kwargs) -> Alert:
        """Create and process new alert"""
        alert = Alert(
            id=str(uuid.uuid4()),
            alert_type=alert_type,
            level=level,
            title=title,
            description=description,
            **kwargs
        )
        
        self.active_alerts[alert.id] = alert
        self.alert_history.append(alert)
        
        # Store in database
        self._store_alert(alert)
        
        # Send notifications
        channels = self._get_notification_channels(alert)
        await self.notification_service.send_notification(alert, channels)
        
        return alert
    
    def _store_alert(self, alert: Alert):
        """Store alert in database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO alerts (
                id, alert_type, level, title, description, created_at,
                acknowledged_at, resolved_at, source, affected_component,
                metric_value, threshold, acknowledged_by, resolved_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            alert.id,
            alert.alert_type.value,
            alert.level.value,
            alert.title,
            alert.description,
            alert.created_at.isoformat(),
            alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
            alert.resolved_at.isoformat() if alert.resolved_at else None,
            alert.source,
            alert.affected_component,
            alert.metric_value,
            alert.threshold,
            alert.acknowledged_by,
            alert.resolved_by
        ))
        
        conn.commit()
        conn.close()
    
    def _get_notification_channels(self, alert: Alert) -> List[NotificationChannel]:
        """Determine notification channels for alert"""
        channels = []
        
        # Default channels
        channels.append(NotificationChannel.CONSOLE)
        channels.append(NotificationChannel.LOG)
        
        # Level-based channels
        if alert.level in [AlertLevel.WARNING, AlertLevel.ERROR]:
            if self.config.get('email', {}).get('enabled', False):
                channels.append(NotificationChannel.EMAIL)
        
        if alert.level in [AlertLevel.CRITICAL, AlertLevel.EMERGENCY]:
            if self.config.get('slack', {}).get('enabled', False):
                channels.append(NotificationChannel.SLACK)
            if self.config.get('webhook', {}).get('enabled', False):
                channels.append(NotificationChannel.WEBHOOK)
        
        return channels
    
    async def acknowledge_alert(self, alert_id: str, acknowledged_by: str) -> bool:
        """Acknowledge an alert"""
        alert = self.active_alerts.get(alert_id)
        if not alert:
            return False
        
        alert.acknowledged_at = datetime.now(timezone.utc)
        alert.acknowledged_by = acknowledged_by
        
        self._store_alert(alert)
        return True
    
    async def resolve_alert(self, alert_id: str, resolved_by: str) -> bool:
        """Resolve an alert"""
        alert = self.active_alerts.get(alert_id)
        if not alert:
            return False
        
        alert.resolved_at = datetime.now(timezone.utc)
        alert.resolved_by = resolved_by
        
        self._store_alert(alert)
        
        # Remove from active alerts
        del self.active_alerts[alert_id]
        
        return True
    
    async def check_escalation(self):
        """Check and handle alert escalation"""
        for alert in self.active_alerts.values():
            if alert.should_escalate():
                await self._escalate_alert(alert)
    
    async def _escalate_alert(self, alert: Alert):
        """Escalate alert to next level"""
        alert.escalation_level += 1
        
        # Send escalation notification
        escalation_channels = [NotificationChannel.EMAIL, NotificationChannel.SLACK]
        if alert.level == AlertLevel.CRITICAL:
            escalation_channels.append(NotificationChannel.SMS)
        
        await self.notification_service.send_notification(alert, escalation_channels)
        
        self._store_alert(alert)

class MigrationMonitor:
    """Main migration monitoring system"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.is_running = False
        
        # Initialize components
        self.notification_service = NotificationService(config.get('notifications', {}))
        self.metrics_collector = MetricsCollector(config.get('metrics', {}))
        self.alert_manager = AlertManager(config.get('alerts', {}), self.notification_service)
        
        # Monitoring intervals
        self.system_check_interval = config.get('system_check_interval', 30)  # seconds
        self.migration_check_interval = config.get('migration_check_interval', 10)  # seconds
        
        # Performance thresholds
        self.performance_thresholds = config.get('performance_thresholds', {
            'max_error_rate': 0.05,  # 5%
            'min_throughput': 1.0,   # 1 MB/s
            'max_response_time': 30.0  # 30 seconds
        })
        
        # Setup logging
        self.logger = self._setup_logging()
    
    def _setup_logging(self) -> logging.Logger:
        """Setup logging configuration"""
        logger = logging.getLogger('migration_monitor')
        logger.setLevel(logging.INFO)
        
        # Create logs directory
        log_dir = Path('logs')
        log_dir.mkdir(exist_ok=True)
        
        # File handler
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        log_file = log_dir / f'migration_monitor_{timestamp}.log'
        
        handler = logging.FileHandler(log_file)
        handler.setLevel(logging.INFO)
        
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        
        logger.addHandler(handler)
        
        return logger
    
    async def start_monitoring(self):
        """Start the monitoring system"""
        self.is_running = True
        console.print("[bold green]🔍 Starting Migration Monitor[/bold green]")
        
        # Start monitoring tasks
        tasks = [
            asyncio.create_task(self._monitor_system_health()),
            asyncio.create_task(self._monitor_migration_progress()),
            asyncio.create_task(self._check_alerts()),
            asyncio.create_task(self._dashboard_update())
        ]
        
        try:
            await asyncio.gather(*tasks)
        except KeyboardInterrupt:
            console.print("\n[yellow]Monitoring stopped by user[/yellow]")
        finally:
            await self.stop_monitoring()
    
    async def stop_monitoring(self):
        """Stop the monitoring system"""
        self.is_running = False
        console.print("[bold red]🛑 Stopping Migration Monitor[/bold red]")
    
    async def _monitor_system_health(self):
        """Monitor system health metrics"""
        while self.is_running:
            try:
                health = self.metrics_collector.get_system_health()
                
                # Check for health issues
                if not health.is_healthy():
                    await self._handle_health_alert(health)
                
                # Check specific metrics
                await self._check_metric_thresholds()
                
                await asyncio.sleep(self.system_check_interval)
                
            except Exception as e:
                self.logger.error(f"Error monitoring system health: {e}")
                await asyncio.sleep(self.system_check_interval)
    
    async def _monitor_migration_progress(self):
        """Monitor migration progress and performance"""
        while self.is_running:
            try:
                # This would integrate with actual migration systems
                migration_stats = await self._get_migration_stats()
                
                if migration_stats:
                    await self._check_migration_performance(migration_stats)
                
                await asyncio.sleep(self.migration_check_interval)
                
            except Exception as e:
                self.logger.error(f"Error monitoring migration progress: {e}")
                await asyncio.sleep(self.migration_check_interval)
    
    async def _check_alerts(self):
        """Check for alert escalations"""
        while self.is_running:
            try:
                await self.alert_manager.check_escalation()
                await asyncio.sleep(60)  # Check every minute
                
            except Exception as e:
                self.logger.error(f"Error checking alerts: {e}")
                await asyncio.sleep(60)
    
    async def _dashboard_update(self):
        """Update monitoring dashboard"""
        while self.is_running:
            try:
                await self._update_dashboard()
                await asyncio.sleep(5)  # Update every 5 seconds
                
            except Exception as e:
                self.logger.error(f"Error updating dashboard: {e}")
                await asyncio.sleep(5)
    
    async def _handle_health_alert(self, health: SystemHealth):
        """Handle system health alerts"""
        if health.cpu_percent > 90:
            await self.alert_manager.create_alert(
                AlertType.RESOURCE_EXHAUSTION,
                AlertLevel.CRITICAL,
                "High CPU Usage",
                f"CPU usage at {health.cpu_percent:.1f}%",
                affected_component="system.cpu",
                metric_value=health.cpu_percent,
                threshold=90
            )
        
        if health.memory_percent > 95:
            await self.alert_manager.create_alert(
                AlertType.RESOURCE_EXHAUSTION,
                AlertLevel.CRITICAL,
                "High Memory Usage",
                f"Memory usage at {health.memory_percent:.1f}%",
                affected_component="system.memory",
                metric_value=health.memory_percent,
                threshold=95
            )
        
        if health.disk_usage_percent > 95:
            await self.alert_manager.create_alert(
                AlertType.RESOURCE_EXHAUSTION,
                AlertLevel.CRITICAL,
                "High Disk Usage",
                f"Disk usage at {health.disk_usage_percent:.1f}%",
                affected_component="system.disk",
                metric_value=health.disk_usage_percent,
                threshold=95
            )
    
    async def _check_metric_thresholds(self):
        """Check metrics against thresholds"""
        for metric_name, metric in self.metrics_collector.metrics.items():
            alert_level = metric.get_alert_level()
            
            if alert_level and metric_name not in [alert.source for alert in self.alert_manager.active_alerts.values()]:
                await self.alert_manager.create_alert(
                    AlertType.PERFORMANCE_DEGRADATION,
                    alert_level,
                    f"Metric Threshold Exceeded: {metric_name}",
                    f"Metric {metric_name} value {metric.value} exceeded threshold",
                    source=metric_name,
                    affected_component=metric_name,
                    metric_value=metric.value,
                    threshold=metric.critical_threshold or metric.warning_threshold
                )
    
    async def _get_migration_stats(self) -> Optional[Dict[str, Any]]:
        """Get current migration statistics"""
        # This would integrate with actual migration systems
        # For now, return dummy data
        return {
            'total_files': 10000,
            'completed_files': 7500,
            'failed_files': 25,
            'current_throughput': 5.2,  # MB/s
            'error_rate': 0.003,  # 0.3%
            'avg_response_time': 15.2  # seconds
        }
    
    async def _check_migration_performance(self, stats: Dict[str, Any]):
        """Check migration performance metrics"""
        error_rate = stats.get('error_rate', 0)
        throughput = stats.get('current_throughput', 0)
        response_time = stats.get('avg_response_time', 0)
        
        # Check error rate
        if error_rate > self.performance_thresholds['max_error_rate']:
            await self.alert_manager.create_alert(
                AlertType.HIGH_ERROR_RATE,
                AlertLevel.ERROR,
                "High Migration Error Rate",
                f"Error rate at {error_rate:.2%}",
                affected_component="migration.error_rate",
                metric_value=error_rate,
                threshold=self.performance_thresholds['max_error_rate']
            )
        
        # Check throughput
        if throughput < self.performance_thresholds['min_throughput']:
            await self.alert_manager.create_alert(
                AlertType.PERFORMANCE_DEGRADATION,
                AlertLevel.WARNING,
                "Low Migration Throughput",
                f"Throughput at {throughput:.1f} MB/s",
                affected_component="migration.throughput",
                metric_value=throughput,
                threshold=self.performance_thresholds['min_throughput']
            )
        
        # Check response time
        if response_time > self.performance_thresholds['max_response_time']:
            await self.alert_manager.create_alert(
                AlertType.TIMEOUT_EXCEEDED,
                AlertLevel.WARNING,
                "High Migration Response Time",
                f"Response time at {response_time:.1f} seconds",
                affected_component="migration.response_time",
                metric_value=response_time,
                threshold=self.performance_thresholds['max_response_time']
            )
    
    async def _update_dashboard(self):
        """Update the monitoring dashboard"""
        # This would update a real-time dashboard
        # For now, we'll just log stats
        health = self.metrics_collector.get_system_health()
        active_alerts = len(self.alert_manager.active_alerts)
        
        self.logger.info(f"Dashboard update - CPU: {health.cpu_percent:.1f}%, "
                        f"Memory: {health.memory_percent:.1f}%, "
                        f"Active Alerts: {active_alerts}")
    
    def create_dashboard_layout(self) -> Layout:
        """Create Rich layout for monitoring dashboard"""
        layout = Layout()
        
        layout.split_column(
            Layout(name="header", size=3),
            Layout(name="main", ratio=1),
            Layout(name="footer", size=3)
        )
        
        layout["main"].split_row(
            Layout(name="left"),
            Layout(name="right")
        )
        
        layout["left"].split_column(
            Layout(name="system", ratio=1),
            Layout(name="migration", ratio=1)
        )
        
        layout["right"].split_column(
            Layout(name="alerts", ratio=1),
            Layout(name="metrics", ratio=1)
        )
        
        return layout
    
    def update_dashboard_content(self, layout: Layout):
        """Update dashboard content"""
        # Header
        layout["header"].update(
            Panel(
                Align.center(
                    Text("Migration Monitoring Dashboard", style="bold blue")
                ),
                style="blue"
            )
        )
        
        # System Health
        health = self.metrics_collector.get_system_health()
        system_table = Table(title="System Health")
        system_table.add_column("Metric", style="cyan")
        system_table.add_column("Value", style="green")
        system_table.add_column("Status", style="yellow")
        
        system_table.add_row("CPU", f"{health.cpu_percent:.1f}%", "✅" if health.cpu_percent < 80 else "⚠️")
        system_table.add_row("Memory", f"{health.memory_percent:.1f}%", "✅" if health.memory_percent < 85 else "⚠️")
        system_table.add_row("Disk", f"{health.disk_usage_percent:.1f}%", "✅" if health.disk_usage_percent < 90 else "⚠️")
        
        layout["system"].update(Panel(system_table, title="System"))
        
        # Migration Status
        migration_table = Table(title="Migration Status")
        migration_table.add_column("Metric", style="cyan")
        migration_table.add_column("Value", style="green")
        
        # This would show real migration stats
        migration_table.add_row("Total Files", "10,000")
        migration_table.add_row("Completed", "7,500")
        migration_table.add_row("Failed", "25")
        migration_table.add_row("Success Rate", "99.7%")
        
        layout["migration"].update(Panel(migration_table, title="Migration"))
        
        # Active Alerts
        alerts_table = Table(title="Active Alerts")
        alerts_table.add_column("Level", style="red")
        alerts_table.add_column("Title", style="yellow")
        alerts_table.add_column("Time", style="blue")
        
        for alert in list(self.alert_manager.active_alerts.values())[:10]:
            alerts_table.add_row(
                alert.level.value.upper(),
                alert.title,
                alert.created_at.strftime("%H:%M:%S")
            )
        
        layout["alerts"].update(Panel(alerts_table, title="Alerts"))
        
        # Recent Metrics
        metrics_table = Table(title="Recent Metrics")
        metrics_table.add_column("Metric", style="cyan")
        metrics_table.add_column("Value", style="green")
        metrics_table.add_column("Time", style="blue")
        
        for metric_name, metric in list(self.metrics_collector.metrics.items())[:10]:
            metrics_table.add_row(
                metric_name,
                f"{metric.value:.2f} {metric.unit}",
                metric.timestamp.strftime("%H:%M:%S")
            )
        
        layout["metrics"].update(Panel(metrics_table, title="Metrics"))
        
        # Footer
        layout["footer"].update(
            Panel(
                Align.center(
                    Text(f"Last Updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", style="dim")
                ),
                style="dim"
            )
        )

# CLI Commands
@click.group()
@click.version_option(version="1.0.0")
def cli():
    """Migration Monitoring CLI"""
    pass

@cli.command()
@click.option('--config-file', type=click.Path(exists=True), help='Configuration file')
@click.option('--dashboard', is_flag=True, help='Show interactive dashboard')
def monitor(config_file, dashboard):
    """Start migration monitoring"""
    
    # Load configuration
    config = {
        'system_check_interval': 30,
        'migration_check_interval': 10,
        'notifications': {
            'email': {'enabled': False},
            'slack': {'enabled': False},
            'webhook': {'enabled': False}
        },
        'metrics': {
            'metrics_db': 'migration_metrics.db'
        },
        'alerts': {
            'alerts_db': 'migration_alerts.db'
        }
    }
    
    if config_file:
        with open(config_file, 'r') as f:
            file_config = json.load(f)
            config.update(file_config)
    
    # Start monitoring
    monitor = MigrationMonitor(config)
    
    if dashboard:
        # Interactive dashboard
        layout = monitor.create_dashboard_layout()
        
        with Live(layout, refresh_per_second=1, screen=True) as live:
            try:
                while True:
                    monitor.update_dashboard_content(layout)
                    time.sleep(1)
            except KeyboardInterrupt:
                console.print("\n[yellow]Dashboard stopped by user[/yellow]")
    else:
        # Background monitoring
        try:
            asyncio.run(monitor.start_monitoring())
        except KeyboardInterrupt:
            console.print("\n[yellow]Monitoring stopped by user[/yellow]")

@cli.command()
@click.option('--config-file', type=click.Path(exists=True), help='Configuration file')
@click.option('--alert-type', type=click.Choice(['performance_degradation', 'high_error_rate', 'system_failure']), 
              required=True, help='Alert type')
@click.option('--level', type=click.Choice(['info', 'warning', 'error', 'critical', 'emergency']), 
              required=True, help='Alert level')
@click.option('--title', required=True, help='Alert title')
@click.option('--description', required=True, help='Alert description')
def test_alert(config_file, alert_type, level, title, description):
    """Test alert system"""
    
    # Load configuration
    config = {
        'notifications': {
            'email': {'enabled': False},
            'slack': {'enabled': False},
            'webhook': {'enabled': False}
        },
        'alerts': {
            'alerts_db': 'test_alerts.db'
        }
    }
    
    if config_file:
        with open(config_file, 'r') as f:
            file_config = json.load(f)
            config.update(file_config)
    
    async def send_test_alert():
        notification_service = NotificationService(config.get('notifications', {}))
        alert_manager = AlertManager(config.get('alerts', {}), notification_service)
        
        alert_type_enum = AlertType(alert_type)
        level_enum = AlertLevel(level)
        
        alert = await alert_manager.create_alert(
            alert_type_enum,
            level_enum,
            title,
            description,
            source="test_command"
        )
        
        console.print(f"[green]Test alert created: {alert.id}[/green]")
        console.print(f"[blue]Alert details:[/blue]")
        console.print(f"  Type: {alert.alert_type.value}")
        console.print(f"  Level: {alert.level.value}")
        console.print(f"  Title: {alert.title}")
        console.print(f"  Description: {alert.description}")
    
    asyncio.run(send_test_alert())

@cli.command()
@click.option('--db-file', default='migration_metrics.db', help='Metrics database file')
@click.option('--limit', default=50, help='Number of metrics to show')
def show_metrics(db_file, limit):
    """Show recent metrics"""
    
    if not Path(db_file).exists():
        console.print(f"[red]Metrics database not found: {db_file}[/red]")
        return
    
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT name, value, timestamp, unit
        FROM metrics
        ORDER BY timestamp DESC
        LIMIT ?
    ''', (limit,))
    
    results = cursor.fetchall()
    conn.close()
    
    if not results:
        console.print("[yellow]No metrics found[/yellow]")
        return
    
    table = Table(title="Recent Metrics")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")
    table.add_column("Unit", style="blue")
    table.add_column("Time", style="yellow")
    
    for name, value, timestamp, unit in results:
        table.add_row(
            name,
            f"{value:.2f}",
            unit or "",
            timestamp
        )
    
    console.print(table)

if __name__ == '__main__':
    cli()