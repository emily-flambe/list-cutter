-- Phase 6: Storage Metrics and Cost Tracking Implementation
-- Adds comprehensive storage metrics table and cost calculation support

-- Storage metrics table for R2 operation tracking and cost calculation
CREATE TABLE storage_metrics (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    
    -- Time and user identification
    metric_date DATE NOT NULL,
    user_id TEXT NOT NULL,
    
    -- Metric type and operation details
    metric_type TEXT NOT NULL CHECK (metric_type IN ('storage_bytes', 'requests_class_a', 'requests_class_b', 'data_transfer_out', 'data_transfer_in')),
    operation_type TEXT CHECK (operation_type IN ('upload_single', 'upload_multipart', 'upload_part', 'download', 'delete', 'list', 'head', 'abort_multipart', 'complete_multipart')),
    
    -- Raw metric values
    total_bytes INTEGER DEFAULT 0,
    total_operations INTEGER DEFAULT 0,
    
    -- Storage-specific metrics
    storage_class TEXT DEFAULT 'Standard' CHECK (storage_class IN ('Standard', 'InfrequentAccess')),
    avg_object_size INTEGER DEFAULT 0,
    unique_objects INTEGER DEFAULT 0,
    
    -- Cost calculation fields (in USD)
    unit_cost_usd REAL DEFAULT 0.0,
    total_cost_usd REAL DEFAULT 0.0,
    
    -- Performance metrics
    total_duration_ms INTEGER DEFAULT 0,
    avg_throughput_bps INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 1.0,
    
    -- Error tracking
    error_count INTEGER DEFAULT 0,
    error_types TEXT, -- JSON array of error categories
    
    -- Aggregation metadata
    is_aggregated BOOLEAN DEFAULT 0,
    aggregation_level TEXT DEFAULT 'daily' CHECK (aggregation_level IN ('hourly', 'daily', 'weekly', 'monthly')),
    source_records INTEGER DEFAULT 1,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Unique constraint for daily aggregations
    UNIQUE(user_id, metric_date, metric_type, storage_class, aggregation_level)
);

-- Indexes for efficient querying
CREATE INDEX idx_storage_metrics_date ON storage_metrics(metric_date);
CREATE INDEX idx_storage_metrics_user_date ON storage_metrics(user_id, metric_date);
CREATE INDEX idx_storage_metrics_type ON storage_metrics(metric_type);
CREATE INDEX idx_storage_metrics_user_type_date ON storage_metrics(user_id, metric_type, metric_date);
CREATE INDEX idx_storage_metrics_aggregation ON storage_metrics(aggregation_level, is_aggregated);
CREATE INDEX idx_storage_metrics_cost ON storage_metrics(total_cost_usd);
CREATE INDEX idx_storage_metrics_created_at ON storage_metrics(created_at);

-- Cost calculation reference table for R2 pricing
CREATE TABLE r2_pricing_tiers (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    
    -- Pricing tier information
    tier_name TEXT NOT NULL,
    metric_type TEXT NOT NULL CHECK (metric_type IN ('storage_bytes', 'requests_class_a', 'requests_class_b', 'data_transfer_out', 'data_transfer_in')),
    storage_class TEXT DEFAULT 'Standard' CHECK (storage_class IN ('Standard', 'InfrequentAccess')),
    
    -- Tier bounds (in bytes for storage, operations for requests)
    min_units INTEGER DEFAULT 0,
    max_units INTEGER, -- NULL for unlimited
    
    -- Pricing (per GB for storage, per 1000 requests for operations)
    unit_cost_usd REAL NOT NULL,
    
    -- Regional pricing support
    region TEXT DEFAULT 'global',
    
    -- Effective dates
    effective_from DATE NOT NULL,
    effective_until DATE,
    
    -- Metadata
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(tier_name, metric_type, storage_class, region, effective_from)
);

-- Insert current Cloudflare R2 pricing (as of 2024)
INSERT INTO r2_pricing_tiers (tier_name, metric_type, storage_class, min_units, max_units, unit_cost_usd, effective_from, description) VALUES
-- Storage pricing (per GB per month)
('Free Tier', 'storage_bytes', 'Standard', 0, 10737418240, 0.0, '2024-01-01', 'First 10 GB free per month'),
('Standard Tier', 'storage_bytes', 'Standard', 10737418240, NULL, 0.015, '2024-01-01', 'Standard storage after 10 GB: $0.015 per GB per month'),
('Infrequent Access', 'storage_bytes', 'InfrequentAccess', 0, NULL, 0.01, '2024-01-01', 'Infrequent access storage: $0.01 per GB per month'),

-- Class A operations (per 1000 requests) - PUT, COPY, POST, LIST
('Free Tier', 'requests_class_a', 'Standard', 0, 1000000, 0.0, '2024-01-01', 'First 1 million Class A requests free per month'),
('Standard Tier', 'requests_class_a', 'Standard', 1000000, NULL, 4.50, '2024-01-01', 'Class A requests after 1M: $4.50 per million requests'),
('Infrequent Access', 'requests_class_a', 'InfrequentAccess', 0, NULL, 4.50, '2024-01-01', 'Class A requests for IA: $4.50 per million requests'),

-- Class B operations (per 1000 requests) - GET, HEAD, OPTIONS
('Free Tier', 'requests_class_b', 'Standard', 0, 10000000, 0.0, '2024-01-01', 'First 10 million Class B requests free per month'),
('Standard Tier', 'requests_class_b', 'Standard', 10000000, NULL, 0.36, '2024-01-01', 'Class B requests after 10M: $0.36 per million requests'),
('Infrequent Access', 'requests_class_b', 'InfrequentAccess', 0, NULL, 0.36, '2024-01-01', 'Class B requests for IA: $0.36 per million requests'),

-- Data transfer out (per GB) - egress from R2 to internet
('Free Tier', 'data_transfer_out', 'Standard', 0, 10737418240, 0.0, '2024-01-01', 'First 10 GB data transfer free per month'),
('Standard Tier', 'data_transfer_out', 'Standard', 10737418240, NULL, 0.09, '2024-01-01', 'Data transfer out after 10 GB: $0.09 per GB'),
('Infrequent Access', 'data_transfer_out', 'InfrequentAccess', 0, NULL, 0.09, '2024-01-01', 'Data transfer out for IA: $0.09 per GB'),

-- Data transfer in (per GB) - ingress to R2 (typically free)
('Free Tier', 'data_transfer_in', 'Standard', 0, NULL, 0.0, '2024-01-01', 'Data transfer in is free'),
('Free Tier', 'data_transfer_in', 'InfrequentAccess', 0, NULL, 0.0, '2024-01-01', 'Data transfer in is free');

-- Daily storage snapshots for accurate billing
CREATE TABLE daily_storage_snapshots (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    snapshot_date DATE NOT NULL,
    
    -- Storage metrics by class
    total_objects INTEGER DEFAULT 0,
    total_bytes INTEGER DEFAULT 0,
    standard_objects INTEGER DEFAULT 0,
    standard_bytes INTEGER DEFAULT 0,
    ia_objects INTEGER DEFAULT 0,
    ia_bytes INTEGER DEFAULT 0,
    
    -- Daily operation counts
    class_a_operations INTEGER DEFAULT 0,
    class_b_operations INTEGER DEFAULT 0,
    bytes_transferred_out INTEGER DEFAULT 0,
    bytes_transferred_in INTEGER DEFAULT 0,
    
    -- Calculated costs (in USD)
    storage_cost_usd REAL DEFAULT 0.0,
    class_a_cost_usd REAL DEFAULT 0.0,
    class_b_cost_usd REAL DEFAULT 0.0,
    transfer_out_cost_usd REAL DEFAULT 0.0,
    transfer_in_cost_usd REAL DEFAULT 0.0,
    total_daily_cost_usd REAL DEFAULT 0.0,
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Unique constraint for daily snapshots
    UNIQUE(user_id, snapshot_date)
);

-- Indexes for daily snapshots
CREATE INDEX idx_daily_snapshots_user_date ON daily_storage_snapshots(user_id, snapshot_date);
CREATE INDEX idx_daily_snapshots_date ON daily_storage_snapshots(snapshot_date);
CREATE INDEX idx_daily_snapshots_cost ON daily_storage_snapshots(total_daily_cost_usd);

-- Monthly aggregated billing summary
CREATE TABLE monthly_billing_summary (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    billing_month DATE NOT NULL, -- First day of the month
    
    -- Storage usage (average for the month)
    avg_storage_bytes INTEGER DEFAULT 0,
    max_storage_bytes INTEGER DEFAULT 0,
    avg_objects INTEGER DEFAULT 0,
    
    -- Operation totals
    total_class_a_operations INTEGER DEFAULT 0,
    total_class_b_operations INTEGER DEFAULT 0,
    total_bytes_transferred_out INTEGER DEFAULT 0,
    total_bytes_transferred_in INTEGER DEFAULT 0,
    
    -- Cost breakdown (in USD)
    storage_cost_usd REAL DEFAULT 0.0,
    class_a_cost_usd REAL DEFAULT 0.0,
    class_b_cost_usd REAL DEFAULT 0.0,
    transfer_out_cost_usd REAL DEFAULT 0.0,
    transfer_in_cost_usd REAL DEFAULT 0.0,
    total_monthly_cost_usd REAL DEFAULT 0.0,
    
    -- Free tier usage tracking
    free_storage_used_bytes INTEGER DEFAULT 0,
    free_class_a_used INTEGER DEFAULT 0,
    free_class_b_used INTEGER DEFAULT 0,
    free_transfer_out_used_bytes INTEGER DEFAULT 0,
    
    -- Billing status
    billing_status TEXT DEFAULT 'pending' CHECK (billing_status IN ('pending', 'calculated', 'billed', 'paid')),
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Unique constraint for monthly billing
    UNIQUE(user_id, billing_month)
);

-- Indexes for monthly billing
CREATE INDEX idx_monthly_billing_user_month ON monthly_billing_summary(user_id, billing_month);
CREATE INDEX idx_monthly_billing_month ON monthly_billing_summary(billing_month);
CREATE INDEX idx_monthly_billing_cost ON monthly_billing_summary(total_monthly_cost_usd);
CREATE INDEX idx_monthly_billing_status ON monthly_billing_summary(billing_status);

-- Usage quotas and limits per user
CREATE TABLE user_storage_quotas (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    
    -- Storage limits (in bytes)
    max_storage_bytes INTEGER DEFAULT 5368709120, -- 5 GB default
    max_objects INTEGER DEFAULT 100000,
    
    -- Operation limits (per month)
    max_class_a_operations INTEGER DEFAULT 1000000,
    max_class_b_operations INTEGER DEFAULT 10000000,
    max_transfer_out_bytes INTEGER DEFAULT 10737418240, -- 10 GB
    
    -- Cost limits (in USD per month)
    max_monthly_cost_usd REAL DEFAULT 50.0,
    
    -- Quota type and billing
    quota_type TEXT DEFAULT 'free' CHECK (quota_type IN ('free', 'paid', 'enterprise')),
    billing_enabled BOOLEAN DEFAULT 0,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Unique constraint per user
    UNIQUE(user_id)
);

-- Indexes for quotas
CREATE INDEX idx_user_quotas_user_id ON user_storage_quotas(user_id);
CREATE INDEX idx_user_quotas_type ON user_storage_quotas(quota_type);

-- Insert default quotas for existing users
INSERT INTO user_storage_quotas (user_id, quota_type, billing_enabled)
SELECT id, 'free', 0 FROM users WHERE id NOT IN (SELECT user_id FROM user_storage_quotas);

-- Triggers for updated_at timestamps
CREATE TRIGGER update_storage_metrics_timestamp 
AFTER UPDATE ON storage_metrics
BEGIN
    UPDATE storage_metrics SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_daily_snapshots_timestamp 
AFTER UPDATE ON daily_storage_snapshots
BEGIN
    UPDATE daily_storage_snapshots SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_monthly_billing_timestamp 
AFTER UPDATE ON monthly_billing_summary
BEGIN
    UPDATE monthly_billing_summary SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_user_quotas_timestamp 
AFTER UPDATE ON user_storage_quotas
BEGIN
    UPDATE user_storage_quotas SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Auto-create quotas for new users
CREATE TRIGGER create_user_quotas_for_new_users
AFTER INSERT ON users
BEGIN
    INSERT INTO user_storage_quotas (user_id, quota_type, billing_enabled)
    VALUES (NEW.id, 'free', 0);
END;

-- Views for common queries
CREATE VIEW user_current_usage AS
SELECT 
    u.id as user_id,
    u.email,
    u.username,
    COALESCE(f.total_files, 0) as total_files,
    COALESCE(f.total_bytes, 0) as total_bytes,
    COALESCE(f.standard_bytes, 0) as standard_bytes,
    COALESCE(f.ia_bytes, 0) as ia_bytes,
    q.max_storage_bytes,
    q.max_objects,
    q.quota_type,
    q.billing_enabled,
    ROUND((CAST(COALESCE(f.total_bytes, 0) AS REAL) / q.max_storage_bytes) * 100, 2) as storage_usage_percentage
FROM users u
LEFT JOIN user_storage_quotas q ON u.id = q.user_id
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(*) as total_files,
        SUM(file_size) as total_bytes,
        SUM(CASE WHEN storage_class = 'Standard' THEN file_size ELSE 0 END) as standard_bytes,
        SUM(CASE WHEN storage_class = 'InfrequentAccess' THEN file_size ELSE 0 END) as ia_bytes
    FROM files
    GROUP BY user_id
) f ON u.id = f.user_id;

CREATE VIEW monthly_cost_summary AS
SELECT 
    u.id as user_id,
    u.email,
    u.username,
    mb.billing_month,
    mb.total_monthly_cost_usd,
    mb.storage_cost_usd,
    mb.class_a_cost_usd,
    mb.class_b_cost_usd,
    mb.transfer_out_cost_usd,
    mb.billing_status,
    q.max_monthly_cost_usd,
    q.quota_type,
    ROUND((mb.total_monthly_cost_usd / q.max_monthly_cost_usd) * 100, 2) as cost_usage_percentage
FROM users u
LEFT JOIN monthly_billing_summary mb ON u.id = mb.user_id
LEFT JOIN user_storage_quotas q ON u.id = q.user_id
WHERE mb.billing_month IS NOT NULL
ORDER BY mb.billing_month DESC, mb.total_monthly_cost_usd DESC;