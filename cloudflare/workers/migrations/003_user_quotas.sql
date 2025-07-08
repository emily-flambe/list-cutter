-- User Quota Management Migration
-- Adds comprehensive quota management system with tier-based limits and usage tracking

-- Quota tiers configuration table
CREATE TABLE quota_tiers (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    storage_limit INTEGER NOT NULL CHECK (storage_limit >= 0),
    file_count_limit INTEGER NOT NULL CHECK (file_count_limit >= 0),
    max_file_size INTEGER NOT NULL CHECK (max_file_size >= 0),
    bandwidth_limit INTEGER NOT NULL CHECK (bandwidth_limit >= 0),
    requests_per_minute INTEGER NOT NULL CHECK (requests_per_minute >= 0),
    requests_per_hour INTEGER NOT NULL CHECK (requests_per_hour >= 0),
    requests_per_day INTEGER NOT NULL CHECK (requests_per_day >= 0),
    features TEXT NOT NULL, -- JSON array of feature names
    price INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0), -- price in cents
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User quotas table
CREATE TABLE user_quotas (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT UNIQUE NOT NULL,
    tier_id TEXT NOT NULL,
    storage_used INTEGER DEFAULT 0 CHECK (storage_used >= 0),
    file_count INTEGER DEFAULT 0 CHECK (file_count >= 0),
    bandwidth_used INTEGER DEFAULT 0 CHECK (bandwidth_used >= 0),
    requests_this_minute INTEGER DEFAULT 0 CHECK (requests_this_minute >= 0),
    requests_this_hour INTEGER DEFAULT 0 CHECK (requests_this_hour >= 0),
    requests_this_day INTEGER DEFAULT 0 CHECK (requests_this_day >= 0),
    requests_this_month INTEGER DEFAULT 0 CHECK (requests_this_month >= 0),
    last_reset_minute DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_reset_hour DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_reset_day DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_reset_month DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tier_id) REFERENCES quota_tiers(id) ON DELETE RESTRICT
);

-- Quota overrides table for custom limits
CREATE TABLE quota_overrides (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    storage_limit INTEGER CHECK (storage_limit >= 0),
    file_count_limit INTEGER CHECK (file_count_limit >= 0),
    max_file_size INTEGER CHECK (max_file_size >= 0),
    bandwidth_limit INTEGER CHECK (bandwidth_limit >= 0),
    requests_per_minute INTEGER CHECK (requests_per_minute >= 0),
    requests_per_hour INTEGER CHECK (requests_per_hour >= 0),
    requests_per_day INTEGER CHECK (requests_per_day >= 0),
    reason TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Quota usage history for analytics
CREATE TABLE quota_usage_history (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    quota_type TEXT NOT NULL CHECK (quota_type IN ('storage', 'file_count', 'bandwidth', 'requests')),
    usage_value INTEGER NOT NULL CHECK (usage_value >= 0),
    limit_value INTEGER NOT NULL CHECK (limit_value >= 0),
    operation_type TEXT NOT NULL CHECK (operation_type IN ('upload', 'download', 'delete', 'process', 'list', 'metadata')),
    file_id TEXT,
    resource_size INTEGER DEFAULT 0 CHECK (resource_size >= 0),
    metadata TEXT, -- JSON with additional context
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL
);

-- Quota alerts table
CREATE TABLE quota_alerts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('threshold_warning', 'threshold_critical', 'quota_exceeded', 'unusual_activity', 'tier_upgrade_suggested')),
    quota_type TEXT NOT NULL CHECK (quota_type IN ('storage', 'file_count', 'file_size', 'bandwidth', 'requests_per_minute', 'requests_per_hour', 'requests_per_day')),
    threshold_value INTEGER NOT NULL CHECK (threshold_value >= 0),
    current_usage INTEGER NOT NULL CHECK (current_usage >= 0),
    limit_value INTEGER NOT NULL CHECK (limit_value >= 0),
    message TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    is_active BOOLEAN DEFAULT 1,
    acknowledged_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Quota exceeded events log
CREATE TABLE quota_exceeded_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    quota_type TEXT NOT NULL CHECK (quota_type IN ('storage', 'file_count', 'file_size', 'bandwidth', 'requests_per_minute', 'requests_per_hour', 'requests_per_day')),
    operation_type TEXT NOT NULL CHECK (operation_type IN ('upload', 'download', 'delete', 'process', 'list', 'metadata')),
    attempted_value INTEGER NOT NULL CHECK (attempted_value >= 0),
    limit_value INTEGER NOT NULL CHECK (limit_value >= 0),
    file_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    metadata TEXT, -- JSON with additional context
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL
);

-- Daily quota analytics aggregation
CREATE TABLE quota_analytics_daily (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    date DATE NOT NULL,
    storage_used INTEGER DEFAULT 0 CHECK (storage_used >= 0),
    file_count INTEGER DEFAULT 0 CHECK (file_count >= 0),
    bandwidth_used INTEGER DEFAULT 0 CHECK (bandwidth_used >= 0),
    total_requests INTEGER DEFAULT 0 CHECK (total_requests >= 0),
    upload_count INTEGER DEFAULT 0 CHECK (upload_count >= 0),
    download_count INTEGER DEFAULT 0 CHECK (download_count >= 0),
    delete_count INTEGER DEFAULT 0 CHECK (delete_count >= 0),
    quota_exceeded_count INTEGER DEFAULT 0 CHECK (quota_exceeded_count >= 0),
    tier_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tier_id) REFERENCES quota_tiers(id) ON DELETE RESTRICT,
    UNIQUE(user_id, date)
);

-- Create indexes for performance
CREATE INDEX idx_user_quotas_user_id ON user_quotas(user_id);
CREATE INDEX idx_user_quotas_tier_id ON user_quotas(tier_id);
CREATE INDEX idx_user_quotas_expires_at ON user_quotas(expires_at);
CREATE INDEX idx_user_quotas_last_reset_minute ON user_quotas(last_reset_minute);
CREATE INDEX idx_user_quotas_last_reset_hour ON user_quotas(last_reset_hour);
CREATE INDEX idx_user_quotas_last_reset_day ON user_quotas(last_reset_day);
CREATE INDEX idx_user_quotas_last_reset_month ON user_quotas(last_reset_month);

CREATE INDEX idx_quota_overrides_user_id ON quota_overrides(user_id);
CREATE INDEX idx_quota_overrides_expires_at ON quota_overrides(expires_at);
CREATE INDEX idx_quota_overrides_is_active ON quota_overrides(is_active);

CREATE INDEX idx_quota_usage_history_user_id ON quota_usage_history(user_id);
CREATE INDEX idx_quota_usage_history_quota_type ON quota_usage_history(quota_type);
CREATE INDEX idx_quota_usage_history_created_at ON quota_usage_history(created_at);
CREATE INDEX idx_quota_usage_history_file_id ON quota_usage_history(file_id);

CREATE INDEX idx_quota_alerts_user_id ON quota_alerts(user_id);
CREATE INDEX idx_quota_alerts_alert_type ON quota_alerts(alert_type);
CREATE INDEX idx_quota_alerts_is_active ON quota_alerts(is_active);
CREATE INDEX idx_quota_alerts_created_at ON quota_alerts(created_at);

CREATE INDEX idx_quota_exceeded_events_user_id ON quota_exceeded_events(user_id);
CREATE INDEX idx_quota_exceeded_events_quota_type ON quota_exceeded_events(quota_type);
CREATE INDEX idx_quota_exceeded_events_created_at ON quota_exceeded_events(created_at);

CREATE INDEX idx_quota_analytics_daily_user_id ON quota_analytics_daily(user_id);
CREATE INDEX idx_quota_analytics_daily_date ON quota_analytics_daily(date);
CREATE INDEX idx_quota_analytics_daily_tier_id ON quota_analytics_daily(tier_id);

-- Insert default quota tiers
INSERT INTO quota_tiers (id, name, storage_limit, file_count_limit, max_file_size, bandwidth_limit, requests_per_minute, requests_per_hour, requests_per_day, features, price, is_active) VALUES
('free', 'Free', 1073741824, 100, 10485760, 5368709120, 60, 1000, 10000, '["basic_processing", "csv_cutting"]', 0, 1),
('basic', 'Basic', 10737418240, 1000, 52428800, 53687091200, 300, 5000, 50000, '["basic_processing", "csv_cutting", "advanced_filters", "file_lineage"]', 999, 1),
('premium', 'Premium', 107374182400, 10000, 524288000, 536870912000, 1000, 20000, 200000, '["all_basic", "batch_processing", "api_access", "analytics", "priority_support"]', 2999, 1),
('enterprise', 'Enterprise', 1099511627776, 100000, 5368709120, 5497558138880, 5000, 100000, 1000000, '["all_premium", "custom_integrations", "dedicated_support", "sla_guarantee"]', 9999, 1),
('custom', 'Custom', 9223372036854775807, 2147483647, 9223372036854775807, 9223372036854775807, 2147483647, 2147483647, 2147483647, '["unlimited"]', 0, 1);

-- Triggers for automatic quota management

-- Update updated_at timestamp on quota changes
CREATE TRIGGER update_user_quotas_timestamp 
AFTER UPDATE ON user_quotas
BEGIN
    UPDATE user_quotas SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_quota_tiers_timestamp 
AFTER UPDATE ON quota_tiers
BEGIN
    UPDATE quota_tiers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Auto-reset quota counters based on time periods
CREATE TRIGGER auto_reset_minute_quota
AFTER UPDATE ON user_quotas
WHEN NEW.last_reset_minute < datetime('now', '-1 minute')
BEGIN
    UPDATE user_quotas 
    SET requests_this_minute = 0, 
        last_reset_minute = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

CREATE TRIGGER auto_reset_hour_quota
AFTER UPDATE ON user_quotas
WHEN NEW.last_reset_hour < datetime('now', '-1 hour')
BEGIN
    UPDATE user_quotas 
    SET requests_this_hour = 0, 
        last_reset_hour = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

CREATE TRIGGER auto_reset_day_quota
AFTER UPDATE ON user_quotas
WHEN NEW.last_reset_day < datetime('now', '-1 day')
BEGIN
    UPDATE user_quotas 
    SET requests_this_day = 0, 
        last_reset_day = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

CREATE TRIGGER auto_reset_month_quota
AFTER UPDATE ON user_quotas
WHEN NEW.last_reset_month < datetime('now', '-1 month')
BEGIN
    UPDATE user_quotas 
    SET bandwidth_used = 0, 
        requests_this_month = 0,
        last_reset_month = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

-- Auto-create quota record for new users
CREATE TRIGGER auto_create_user_quota
AFTER INSERT ON users
BEGIN
    INSERT INTO user_quotas (user_id, tier_id)
    VALUES (NEW.id, 'free');
END;

-- Auto-expire quota overrides
CREATE TRIGGER auto_expire_quota_overrides
AFTER UPDATE ON quota_overrides
WHEN NEW.expires_at IS NOT NULL AND NEW.expires_at < datetime('now')
BEGIN
    UPDATE quota_overrides 
    SET is_active = 0 
    WHERE id = NEW.id;
END;