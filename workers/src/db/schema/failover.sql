-- Failover Database Schema for R2 Disaster Recovery
-- This schema supports graceful degradation and operation queuing during R2 outages

-- Operation queue table for failed operations
CREATE TABLE IF NOT EXISTS operation_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_type TEXT NOT NULL, -- 'UPLOAD', 'DELETE', 'GET', 'METADATA_UPDATE'
    operation_id TEXT NOT NULL UNIQUE, -- Unique identifier for each operation
    payload TEXT NOT NULL, -- JSON payload containing operation details
    priority INTEGER NOT NULL DEFAULT 5, -- 1=highest, 10=lowest
    user_id INTEGER, -- Optional user context
    file_id TEXT, -- Optional file context
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'
    error_message TEXT, -- Last error message if failed
    scheduled_at TEXT, -- When to retry (for exponential backoff)
    completed_at TEXT, -- When operation was completed
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES saved_files(file_id) ON DELETE CASCADE
);

-- Service status table for monitoring service health
CREATE TABLE IF NOT EXISTS service_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_name TEXT NOT NULL UNIQUE, -- 'R2_STORAGE', 'D1_DATABASE', 'AUTH_KV'
    status TEXT NOT NULL DEFAULT 'HEALTHY', -- 'HEALTHY', 'DEGRADED', 'OFFLINE'
    last_check TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_success TEXT, -- Last successful operation
    last_failure TEXT, -- Last failed operation
    failure_count INTEGER NOT NULL DEFAULT 0,
    degradation_reason TEXT, -- Why service is degraded
    recovery_actions TEXT, -- JSON array of recovery actions taken
    circuit_breaker_state TEXT NOT NULL DEFAULT 'CLOSED', -- 'CLOSED', 'OPEN', 'HALF_OPEN'
    circuit_breaker_opened_at TEXT, -- When circuit breaker opened
    health_metrics TEXT DEFAULT '{}' -- JSON object with health metrics
);

-- User notifications table for system status notifications
CREATE TABLE IF NOT EXISTS user_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    notification_type TEXT NOT NULL, -- 'SERVICE_DEGRADED', 'OPERATION_QUEUED', 'OPERATION_COMPLETED', 'OPERATION_FAILED'
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'INFO', -- 'INFO', 'WARNING', 'ERROR', 'CRITICAL'
    read_status INTEGER NOT NULL DEFAULT 0, -- 0=unread, 1=read
    metadata TEXT DEFAULT '{}', -- JSON object with additional data
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivered_at TEXT, -- When notification was delivered
    acknowledged_at TEXT, -- When user acknowledged notification
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- System events table for audit and monitoring
CREATE TABLE IF NOT EXISTS system_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL, -- 'SERVICE_STATUS_CHANGE', 'DEGRADATION_ACTIVATED', 'RECOVERY_INITIATED'
    event_category TEXT NOT NULL, -- 'FAILOVER', 'HEALTH', 'SECURITY', 'PERFORMANCE'
    service_name TEXT, -- Related service if applicable
    user_id INTEGER, -- Related user if applicable
    event_data TEXT NOT NULL DEFAULT '{}', -- JSON object with event details
    severity TEXT NOT NULL DEFAULT 'INFO',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Failover configurations table
CREATE TABLE IF NOT EXISTS failover_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_name TEXT NOT NULL UNIQUE,
    config_key TEXT NOT NULL,
    config_value TEXT NOT NULL,
    config_type TEXT NOT NULL DEFAULT 'STRING', -- 'STRING', 'NUMBER', 'BOOLEAN', 'JSON'
    description TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_operation_queue_status ON operation_queue(status);
CREATE INDEX IF NOT EXISTS idx_operation_queue_priority ON operation_queue(priority);
CREATE INDEX IF NOT EXISTS idx_operation_queue_scheduled_at ON operation_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_operation_queue_user_id ON operation_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_operation_queue_operation_type ON operation_queue(operation_type);
CREATE INDEX IF NOT EXISTS idx_operation_queue_created_at ON operation_queue(created_at);

CREATE INDEX IF NOT EXISTS idx_service_status_service_name ON service_status(service_name);
CREATE INDEX IF NOT EXISTS idx_service_status_status ON service_status(status);
CREATE INDEX IF NOT EXISTS idx_service_status_last_check ON service_status(last_check);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_read_status ON user_notifications(read_status);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON user_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_user_notifications_type ON user_notifications(notification_type);

CREATE INDEX IF NOT EXISTS idx_system_events_event_type ON system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON system_events(created_at);
CREATE INDEX IF NOT EXISTS idx_system_events_service_name ON system_events(service_name);

CREATE INDEX IF NOT EXISTS idx_failover_config_service_name ON failover_config(service_name);
CREATE INDEX IF NOT EXISTS idx_failover_config_key ON failover_config(config_key);

-- Initialize default service status entries
INSERT OR IGNORE INTO service_status (service_name, status, last_check) VALUES
    ('R2_STORAGE', 'HEALTHY', CURRENT_TIMESTAMP),
    ('D1_DATABASE', 'HEALTHY', CURRENT_TIMESTAMP),
    ('AUTH_KV', 'HEALTHY', CURRENT_TIMESTAMP);

-- Initialize default failover configurations
INSERT OR IGNORE INTO failover_config (service_name, config_key, config_value, config_type, description) VALUES
    ('R2_STORAGE', 'max_retries', '3', 'NUMBER', 'Maximum number of retries for R2 operations'),
    ('R2_STORAGE', 'retry_delay_ms', '1000', 'NUMBER', 'Initial retry delay in milliseconds'),
    ('R2_STORAGE', 'circuit_breaker_threshold', '5', 'NUMBER', 'Number of failures before opening circuit breaker'),
    ('R2_STORAGE', 'circuit_breaker_timeout', '60000', 'NUMBER', 'Circuit breaker timeout in milliseconds'),
    ('R2_STORAGE', 'health_check_interval', '30000', 'NUMBER', 'Health check interval in milliseconds'),
    ('OPERATION_QUEUE', 'max_queue_size', '1000', 'NUMBER', 'Maximum number of operations in queue'),
    ('OPERATION_QUEUE', 'batch_size', '10', 'NUMBER', 'Number of operations to process in batch'),
    ('OPERATION_QUEUE', 'processing_interval', '5000', 'NUMBER', 'Queue processing interval in milliseconds'),
    ('NOTIFICATIONS', 'max_notifications_per_user', '100', 'NUMBER', 'Maximum notifications per user'),
    ('NOTIFICATIONS', 'notification_retention_days', '30', 'NUMBER', 'Days to retain notifications');