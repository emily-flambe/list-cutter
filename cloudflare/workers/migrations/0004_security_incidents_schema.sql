-- Security Incidents and Alerts Schema
-- Adds comprehensive security monitoring tables

-- Security incidents table for tracking security events
CREATE TABLE security_incidents (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    type TEXT NOT NULL CHECK (type IN ('access_denied', 'suspicious_activity', 'rate_limit_exceeded', 'invalid_token', 'permission_escalation')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    user_id TEXT,
    file_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    evidence TEXT NOT NULL, -- JSON with incident details
    resolved BOOLEAN DEFAULT 0,
    resolved_at DATETIME,
    resolved_by TEXT,
    resolution_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_security_incidents_type ON security_incidents(type);
CREATE INDEX idx_security_incidents_severity ON security_incidents(severity);
CREATE INDEX idx_security_incidents_user_id ON security_incidents(user_id);
CREATE INDEX idx_security_incidents_file_id ON security_incidents(file_id);
CREATE INDEX idx_security_incidents_created_at ON security_incidents(created_at);
CREATE INDEX idx_security_incidents_resolved ON security_incidents(resolved);

-- Security alerts table for active alerts requiring attention
CREATE TABLE security_alerts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    incident_id TEXT,
    incident_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    user_id TEXT,
    file_id TEXT,
    ip_address TEXT,
    evidence TEXT NOT NULL, -- JSON with alert details
    acknowledged BOOLEAN DEFAULT 0,
    acknowledged_at DATETIME,
    acknowledged_by TEXT,
    escalated BOOLEAN DEFAULT 0,
    escalated_at DATETIME,
    escalated_to TEXT,
    auto_resolved BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (incident_id) REFERENCES security_incidents(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL,
    FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_security_alerts_incident_type ON security_alerts(incident_type);
CREATE INDEX idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX idx_security_alerts_acknowledged ON security_alerts(acknowledged);
CREATE INDEX idx_security_alerts_escalated ON security_alerts(escalated);
CREATE INDEX idx_security_alerts_created_at ON security_alerts(created_at);
CREATE INDEX idx_security_alerts_user_id ON security_alerts(user_id);
CREATE INDEX idx_security_alerts_file_id ON security_alerts(file_id);

-- IP address reputation table for tracking known bad actors
CREATE TABLE ip_reputation (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    ip_address TEXT UNIQUE NOT NULL,
    reputation_score INTEGER DEFAULT 0, -- 0-100, lower is worse
    total_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    blocked_requests INTEGER DEFAULT 0,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    blocked_until DATETIME,
    country_code TEXT,
    asn TEXT,
    is_proxy BOOLEAN DEFAULT 0,
    is_tor BOOLEAN DEFAULT 0,
    threat_level TEXT DEFAULT 'none' CHECK (threat_level IN ('none', 'low', 'medium', 'high', 'critical')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ip_reputation_ip_address ON ip_reputation(ip_address);
CREATE INDEX idx_ip_reputation_reputation_score ON ip_reputation(reputation_score);
CREATE INDEX idx_ip_reputation_threat_level ON ip_reputation(threat_level);
CREATE INDEX idx_ip_reputation_blocked_until ON ip_reputation(blocked_until);
CREATE INDEX idx_ip_reputation_last_seen ON ip_reputation(last_seen);

-- User behavior analytics table for detecting anomalies
CREATE TABLE user_behavior_analytics (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    date DATE NOT NULL,
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    unique_files_accessed INTEGER DEFAULT 0,
    total_bytes_transferred INTEGER DEFAULT 0,
    unique_ip_addresses INTEGER DEFAULT 0,
    peak_requests_per_hour INTEGER DEFAULT 0,
    avg_response_time_ms REAL DEFAULT 0,
    most_common_operation TEXT,
    unusual_activity_score INTEGER DEFAULT 0, -- 0-100, higher is more unusual
    risk_indicators TEXT, -- JSON array of risk factors
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, date)
);

CREATE INDEX idx_user_behavior_analytics_user_id ON user_behavior_analytics(user_id);
CREATE INDEX idx_user_behavior_analytics_date ON user_behavior_analytics(date);
CREATE INDEX idx_user_behavior_analytics_unusual_activity ON user_behavior_analytics(unusual_activity_score);
CREATE INDEX idx_user_behavior_analytics_risk ON user_behavior_analytics(unusual_activity_score) WHERE unusual_activity_score > 50;

-- File integrity monitoring table
CREATE TABLE file_integrity_checks (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    file_id TEXT NOT NULL,
    check_type TEXT NOT NULL CHECK (check_type IN ('upload', 'periodic', 'access', 'manual')),
    expected_checksum TEXT,
    actual_checksum TEXT,
    file_size INTEGER,
    integrity_status TEXT NOT NULL CHECK (integrity_status IN ('valid', 'corrupted', 'missing', 'modified')),
    error_details TEXT,
    checked_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (checked_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_file_integrity_checks_file_id ON file_integrity_checks(file_id);
CREATE INDEX idx_file_integrity_checks_check_type ON file_integrity_checks(check_type);
CREATE INDEX idx_file_integrity_checks_integrity_status ON file_integrity_checks(integrity_status);
CREATE INDEX idx_file_integrity_checks_created_at ON file_integrity_checks(created_at);

-- Automated security actions log
CREATE TABLE security_actions_log (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    action_type TEXT NOT NULL CHECK (action_type IN ('block_ip', 'suspend_user', 'revoke_token', 'quarantine_file', 'rate_limit')),
    target_type TEXT NOT NULL CHECK (target_type IN ('ip_address', 'user', 'file', 'token')),
    target_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    triggered_by TEXT NOT NULL CHECK (triggered_by IN ('automated', 'manual', 'scheduled')),
    triggered_by_user TEXT,
    action_details TEXT, -- JSON with action-specific details
    duration_seconds INTEGER, -- For temporary actions
    expires_at DATETIME,
    reversed BOOLEAN DEFAULT 0,
    reversed_at DATETIME,
    reversed_by TEXT,
    reversal_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (triggered_by_user) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reversed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_security_actions_log_action_type ON security_actions_log(action_type);
CREATE INDEX idx_security_actions_log_target_type ON security_actions_log(target_type);
CREATE INDEX idx_security_actions_log_target_id ON security_actions_log(target_id);
CREATE INDEX idx_security_actions_log_severity ON security_actions_log(severity);
CREATE INDEX idx_security_actions_log_expires_at ON security_actions_log(expires_at);
CREATE INDEX idx_security_actions_log_created_at ON security_actions_log(created_at);

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_ip_reputation_timestamp 
AFTER UPDATE ON ip_reputation
BEGIN
    UPDATE ip_reputation SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Auto-cleanup triggers for expired security actions
CREATE TRIGGER cleanup_expired_security_actions
AFTER INSERT ON security_actions_log
WHEN NEW.expires_at IS NOT NULL AND NEW.expires_at < datetime('now')
BEGIN
    UPDATE security_actions_log SET reversed = 1, reversed_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Create view for active security alerts
CREATE VIEW active_security_alerts AS
SELECT 
    sa.id,
    sa.incident_type,
    sa.severity,
    sa.description,
    sa.user_id,
    sa.file_id,
    sa.ip_address,
    sa.acknowledged,
    sa.escalated,
    sa.created_at,
    u.username as user_username,
    f.filename as file_filename
FROM security_alerts sa
LEFT JOIN users u ON sa.user_id = u.id
LEFT JOIN files f ON sa.file_id = f.id
WHERE sa.acknowledged = 0
ORDER BY 
    CASE sa.severity 
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
    END,
    sa.created_at ASC;

-- Create view for security dashboard summary
CREATE VIEW security_dashboard_summary AS
SELECT 
    (SELECT COUNT(*) FROM security_alerts WHERE acknowledged = 0) as open_alerts,
    (SELECT COUNT(*) FROM security_alerts WHERE severity = 'critical' AND acknowledged = 0) as critical_alerts,
    (SELECT COUNT(*) FROM security_alerts WHERE severity = 'high' AND acknowledged = 0) as high_alerts,
    (SELECT COUNT(*) FROM security_incidents WHERE created_at >= datetime('now', '-24 hours')) as incidents_24h,
    (SELECT COUNT(*) FROM ip_reputation WHERE threat_level IN ('high', 'critical')) as high_risk_ips,
    (SELECT COUNT(*) FROM user_behavior_analytics WHERE unusual_activity_score > 70 AND date >= date('now', '-7 days')) as unusual_users,
    (SELECT COUNT(*) FROM file_integrity_checks WHERE integrity_status != 'valid' AND created_at >= datetime('now', '-24 hours')) as integrity_issues,
    (SELECT COUNT(*) FROM security_actions_log WHERE action_type = 'block_ip' AND created_at >= datetime('now', '-24 hours')) as blocked_ips_24h;

-- Create view for file security status
CREATE VIEW file_security_status AS
SELECT 
    f.id as file_id,
    f.filename,
    f.user_id as owner_id,
    u.username as owner_username,
    COUNT(DISTINCT fp.user_id) as shared_users_count,
    COUNT(DISTINCT fst.id) as active_shares_count,
    COALESCE(fv.visibility, 'private') as visibility,
    (SELECT COUNT(*) FROM file_access_audit faa WHERE faa.file_id = f.id AND faa.result = 'denied' AND faa.created_at >= datetime('now', '-24 hours')) as denied_accesses_24h,
    (SELECT MAX(fic.created_at) FROM file_integrity_checks fic WHERE fic.file_id = f.id) as last_integrity_check,
    (SELECT fic.integrity_status FROM file_integrity_checks fic WHERE fic.file_id = f.id ORDER BY fic.created_at DESC LIMIT 1) as integrity_status
FROM files f
JOIN users u ON f.user_id = u.id
LEFT JOIN file_permissions fp ON f.id = fp.file_id AND fp.is_active = 1
LEFT JOIN file_share_tokens fst ON f.id = fst.file_id AND fst.is_active = 1 AND fst.expires_at > datetime('now')
LEFT JOIN file_visibility fv ON f.id = fv.file_id
GROUP BY f.id, f.filename, f.user_id, u.username, fv.visibility;