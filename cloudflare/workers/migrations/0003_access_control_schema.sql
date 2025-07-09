-- Access Control and File Sharing Schema
-- Adds comprehensive permission system for file operations

-- File permissions table for role-based access control
CREATE TABLE file_permissions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    file_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer', 'none')),
    permissions TEXT NOT NULL, -- JSON array of operations
    granted_by TEXT NOT NULL,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    metadata TEXT, -- JSON with additional context
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(file_id, user_id, is_active)
);

CREATE INDEX idx_file_permissions_file_id ON file_permissions(file_id);
CREATE INDEX idx_file_permissions_user_id ON file_permissions(user_id);
CREATE INDEX idx_file_permissions_role ON file_permissions(role);
CREATE INDEX idx_file_permissions_expires_at ON file_permissions(expires_at);
CREATE INDEX idx_file_permissions_active ON file_permissions(is_active);

-- File sharing tokens for secure time-limited access
CREATE TABLE file_share_tokens (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    file_id TEXT NOT NULL,
    shared_by TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    permissions TEXT NOT NULL, -- JSON array of operations
    expires_at DATETIME NOT NULL,
    max_uses INTEGER,
    used_count INTEGER DEFAULT 0,
    ip_whitelist TEXT, -- JSON array of allowed IPs
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_file_share_tokens_file_id ON file_share_tokens(file_id);
CREATE INDEX idx_file_share_tokens_shared_by ON file_share_tokens(shared_by);
CREATE INDEX idx_file_share_tokens_token_hash ON file_share_tokens(token_hash);
CREATE INDEX idx_file_share_tokens_expires_at ON file_share_tokens(expires_at);
CREATE INDEX idx_file_share_tokens_active ON file_share_tokens(is_active);

-- File visibility settings
CREATE TABLE file_visibility (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    file_id TEXT UNIQUE NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'internal', 'public')),
    allowed_users TEXT, -- JSON array of user IDs
    allowed_roles TEXT, -- JSON array of role names
    public_access_token TEXT UNIQUE,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX idx_file_visibility_file_id ON file_visibility(file_id);
CREATE INDEX idx_file_visibility_visibility ON file_visibility(visibility);
CREATE INDEX idx_file_visibility_public_token ON file_visibility(public_access_token);

-- Comprehensive file access audit log
CREATE TABLE file_access_audit (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    file_id TEXT NOT NULL,
    user_id TEXT,
    share_token TEXT,
    operation TEXT NOT NULL CHECK (operation IN ('read', 'write', 'delete', 'share', 'admin')),
    result TEXT NOT NULL CHECK (result IN ('allowed', 'denied')),
    reason TEXT,
    ip_address TEXT,
    user_agent TEXT,
    request_id TEXT,
    bytes_transferred INTEGER,
    duration_ms INTEGER,
    metadata TEXT, -- JSON with additional context
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_file_access_audit_file_id ON file_access_audit(file_id);
CREATE INDEX idx_file_access_audit_user_id ON file_access_audit(user_id);
CREATE INDEX idx_file_access_audit_operation ON file_access_audit(operation);
CREATE INDEX idx_file_access_audit_result ON file_access_audit(result);
CREATE INDEX idx_file_access_audit_created_at ON file_access_audit(created_at);
CREATE INDEX idx_file_access_audit_share_token ON file_access_audit(share_token);

-- Security policy configuration
CREATE TABLE security_policies (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    policy_name TEXT UNIQUE NOT NULL,
    max_token_lifetime INTEGER NOT NULL DEFAULT 604800, -- 7 days in seconds
    max_shares_per_file INTEGER NOT NULL DEFAULT 100,
    allow_public_sharing BOOLEAN DEFAULT 1,
    require_ownership_for_delete BOOLEAN DEFAULT 1,
    require_ownership_for_share BOOLEAN DEFAULT 0,
    audit_all_operations BOOLEAN DEFAULT 1,
    ip_whitelist_enabled BOOLEAN DEFAULT 0,
    rate_limit_enabled BOOLEAN DEFAULT 1,
    config_json TEXT, -- JSON with additional policy settings
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_security_policies_active ON security_policies(is_active);
CREATE INDEX idx_security_policies_name ON security_policies(policy_name);

-- Rate limiting table for access control
CREATE TABLE access_rate_limits (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT,
    ip_address TEXT,
    operation TEXT NOT NULL,
    window_start DATETIME NOT NULL,
    window_end DATETIME NOT NULL,
    request_count INTEGER DEFAULT 0,
    blocked_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_access_rate_limits_user_id ON access_rate_limits(user_id);
CREATE INDEX idx_access_rate_limits_ip_address ON access_rate_limits(ip_address);
CREATE INDEX idx_access_rate_limits_operation ON access_rate_limits(operation);
CREATE INDEX idx_access_rate_limits_window ON access_rate_limits(window_start, window_end);

-- File access sessions for tracking active access
CREATE TABLE file_access_sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    file_id TEXT NOT NULL,
    user_id TEXT,
    share_token TEXT,
    session_id TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    operations TEXT NOT NULL, -- JSON array of granted operations
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    bytes_transferred INTEGER DEFAULT 0,
    request_count INTEGER DEFAULT 0,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_file_access_sessions_file_id ON file_access_sessions(file_id);
CREATE INDEX idx_file_access_sessions_user_id ON file_access_sessions(user_id);
CREATE INDEX idx_file_access_sessions_session_id ON file_access_sessions(session_id);
CREATE INDEX idx_file_access_sessions_expires_at ON file_access_sessions(expires_at);
CREATE INDEX idx_file_access_sessions_active ON file_access_sessions(is_active);
CREATE INDEX idx_file_access_sessions_share_token ON file_access_sessions(share_token);

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_file_permissions_timestamp 
AFTER UPDATE ON file_permissions
BEGIN
    UPDATE file_permissions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_file_visibility_timestamp 
AFTER UPDATE ON file_visibility
BEGIN
    UPDATE file_visibility SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_security_policies_timestamp 
AFTER UPDATE ON security_policies
BEGIN
    UPDATE security_policies SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Auto-cleanup triggers for expired tokens and sessions
CREATE TRIGGER cleanup_expired_share_tokens
AFTER INSERT ON file_share_tokens
WHEN NEW.expires_at < datetime('now')
BEGIN
    UPDATE file_share_tokens SET is_active = 0 WHERE id = NEW.id;
END;

CREATE TRIGGER cleanup_expired_access_sessions
AFTER INSERT ON file_access_sessions
WHEN NEW.expires_at < datetime('now')
BEGIN
    UPDATE file_access_sessions SET is_active = 0 WHERE id = NEW.id;
END;

-- Insert default security policy
INSERT INTO security_policies (
    policy_name, max_token_lifetime, max_shares_per_file, allow_public_sharing,
    require_ownership_for_delete, require_ownership_for_share, audit_all_operations,
    ip_whitelist_enabled, rate_limit_enabled, config_json, is_active
) VALUES (
    'default', 604800, 100, 1, 1, 0, 1, 0, 1, '{}', 1
);

-- Create view for active file permissions
CREATE VIEW active_file_permissions AS
SELECT 
    fp.id,
    fp.file_id,
    fp.user_id,
    fp.role,
    fp.permissions,
    fp.granted_by,
    fp.granted_at,
    fp.expires_at,
    fp.metadata,
    f.filename,
    f.user_id as file_owner_id,
    u.username as user_username,
    gu.username as granted_by_username
FROM file_permissions fp
JOIN files f ON fp.file_id = f.id
JOIN users u ON fp.user_id = u.id
LEFT JOIN users gu ON fp.granted_by = gu.id
WHERE fp.is_active = 1 
  AND (fp.expires_at IS NULL OR fp.expires_at > datetime('now'));

-- Create view for active file shares
CREATE VIEW active_file_shares AS
SELECT 
    fst.id,
    fst.file_id,
    fst.shared_by,
    fst.token,
    fst.permissions,
    fst.expires_at,
    fst.max_uses,
    fst.used_count,
    fst.description,
    fst.created_at,
    fst.last_used_at,
    f.filename,
    f.user_id as file_owner_id,
    u.username as shared_by_username
FROM file_share_tokens fst
JOIN files f ON fst.file_id = f.id
JOIN users u ON fst.shared_by = u.id
WHERE fst.is_active = 1 
  AND fst.expires_at > datetime('now')
  AND (fst.max_uses IS NULL OR fst.used_count < fst.max_uses);

-- Create view for file access summary
CREATE VIEW file_access_summary AS
SELECT 
    f.id as file_id,
    f.filename,
    f.user_id as owner_id,
    u.username as owner_username,
    COUNT(DISTINCT fp.user_id) as shared_users_count,
    COUNT(DISTINCT fst.id) as active_shares_count,
    fv.visibility,
    MAX(faa.created_at) as last_accessed_at,
    SUM(CASE WHEN faa.result = 'allowed' THEN 1 ELSE 0 END) as successful_accesses,
    SUM(CASE WHEN faa.result = 'denied' THEN 1 ELSE 0 END) as denied_accesses
FROM files f
JOIN users u ON f.user_id = u.id
LEFT JOIN file_permissions fp ON f.id = fp.file_id AND fp.is_active = 1
LEFT JOIN file_share_tokens fst ON f.id = fst.file_id AND fst.is_active = 1 AND fst.expires_at > datetime('now')
LEFT JOIN file_visibility fv ON f.id = fv.file_id
LEFT JOIN file_access_audit faa ON f.id = faa.file_id
GROUP BY f.id, f.filename, f.user_id, u.username, fv.visibility;