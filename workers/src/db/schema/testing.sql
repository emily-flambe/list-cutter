-- Disaster Recovery Testing Database Schema
-- This schema provides comprehensive testing framework for disaster recovery scenarios

-- Main DR Tests Table
CREATE TABLE IF NOT EXISTS dr_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_type TEXT NOT NULL CHECK (test_type IN ('full_outage', 'partial_degradation', 'circuit_breaker', 'backup_restore', 'failover_mechanism', 'performance_benchmark')),
    scenario TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
    start_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time TEXT,
    rto_target_ms INTEGER, -- Recovery Time Objective target
    rpo_target_ms INTEGER, -- Recovery Point Objective target
    rto_actual_ms INTEGER, -- Actual Recovery Time
    rpo_actual_ms INTEGER, -- Actual Recovery Point
    test_config TEXT DEFAULT '{}', -- JSON configuration for the test
    executed_by TEXT DEFAULT 'system',
    environment TEXT DEFAULT 'test',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Test Results Table (detailed results for each test component)
CREATE TABLE IF NOT EXISTS test_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER NOT NULL,
    component TEXT NOT NULL, -- e.g., 'r2_storage', 'circuit_breaker', 'backup_system'
    test_name TEXT NOT NULL,
    expected_result TEXT NOT NULL,
    actual_result TEXT NOT NULL,
    passed BOOLEAN NOT NULL,
    execution_time_ms INTEGER,
    error_message TEXT,
    details TEXT DEFAULT '{}', -- JSON object with additional details
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (test_id) REFERENCES dr_tests(id) ON DELETE CASCADE
);

-- Test Logs Table (detailed execution logs)
CREATE TABLE IF NOT EXISTS test_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER NOT NULL,
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    event_type TEXT NOT NULL CHECK (event_type IN ('start', 'step', 'warning', 'error', 'success', 'info', 'metric')),
    component TEXT,
    message TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')) DEFAULT 'info',
    metadata TEXT DEFAULT '{}', -- JSON object with additional data
    FOREIGN KEY (test_id) REFERENCES dr_tests(id) ON DELETE CASCADE
);

-- Test Scenarios Template Table
CREATE TABLE IF NOT EXISTS test_scenarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_name TEXT NOT NULL UNIQUE,
    test_type TEXT NOT NULL CHECK (test_type IN ('full_outage', 'partial_degradation', 'circuit_breaker', 'backup_restore', 'failover_mechanism', 'performance_benchmark')),
    description TEXT NOT NULL,
    test_steps TEXT NOT NULL, -- JSON array of test steps
    expected_outcomes TEXT NOT NULL, -- JSON array of expected outcomes
    rto_target_ms INTEGER,
    rpo_target_ms INTEGER,
    prerequisites TEXT DEFAULT '{}', -- JSON object with prerequisites
    cleanup_steps TEXT DEFAULT '[]', -- JSON array of cleanup steps
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Test Schedules Table
CREATE TABLE IF NOT EXISTS test_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_id INTEGER NOT NULL,
    schedule_name TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_run TEXT,
    next_run TEXT,
    run_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (scenario_id) REFERENCES test_scenarios(id) ON DELETE CASCADE
);

-- Test Reports Table (aggregated test reports)
CREATE TABLE IF NOT EXISTS test_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_name TEXT NOT NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'custom', 'incident')),
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    total_tests INTEGER NOT NULL DEFAULT 0,
    passed_tests INTEGER NOT NULL DEFAULT 0,
    failed_tests INTEGER NOT NULL DEFAULT 0,
    avg_rto_ms REAL,
    avg_rpo_ms REAL,
    success_rate REAL,
    test_summary TEXT DEFAULT '{}', -- JSON object with summary data
    recommendations TEXT DEFAULT '[]', -- JSON array of recommendations
    generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    generated_by TEXT DEFAULT 'system'
);

-- Test Metrics Table (performance and reliability metrics)
CREATE TABLE IF NOT EXISTS test_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER NOT NULL,
    metric_name TEXT NOT NULL,
    metric_type TEXT NOT NULL CHECK (metric_type IN ('rto', 'rpo', 'throughput', 'latency', 'error_rate', 'availability')),
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    threshold REAL,
    passed BOOLEAN,
    recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (test_id) REFERENCES dr_tests(id) ON DELETE CASCADE
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_dr_tests_test_type ON dr_tests(test_type);
CREATE INDEX IF NOT EXISTS idx_dr_tests_status ON dr_tests(status);
CREATE INDEX IF NOT EXISTS idx_dr_tests_start_time ON dr_tests(start_time);
CREATE INDEX IF NOT EXISTS idx_dr_tests_executed_by ON dr_tests(executed_by);

CREATE INDEX IF NOT EXISTS idx_test_results_test_id ON test_results(test_id);
CREATE INDEX IF NOT EXISTS idx_test_results_component ON test_results(component);
CREATE INDEX IF NOT EXISTS idx_test_results_passed ON test_results(passed);

CREATE INDEX IF NOT EXISTS idx_test_logs_test_id ON test_logs(test_id);
CREATE INDEX IF NOT EXISTS idx_test_logs_timestamp ON test_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_test_logs_event_type ON test_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_test_logs_level ON test_logs(level);

CREATE INDEX IF NOT EXISTS idx_test_scenarios_test_type ON test_scenarios(test_type);
CREATE INDEX IF NOT EXISTS idx_test_scenarios_enabled ON test_scenarios(enabled);

CREATE INDEX IF NOT EXISTS idx_test_schedules_scenario_id ON test_schedules(scenario_id);
CREATE INDEX IF NOT EXISTS idx_test_schedules_enabled ON test_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_test_schedules_next_run ON test_schedules(next_run);

CREATE INDEX IF NOT EXISTS idx_test_reports_report_type ON test_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_test_reports_period_start ON test_reports(period_start);
CREATE INDEX IF NOT EXISTS idx_test_reports_generated_at ON test_reports(generated_at);

CREATE INDEX IF NOT EXISTS idx_test_metrics_test_id ON test_metrics(test_id);
CREATE INDEX IF NOT EXISTS idx_test_metrics_metric_type ON test_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_test_metrics_recorded_at ON test_metrics(recorded_at);

-- Create views for common queries
CREATE VIEW IF NOT EXISTS v_test_summary AS
SELECT 
    t.id,
    t.test_type,
    t.scenario,
    t.status,
    t.start_time,
    t.end_time,
    t.rto_actual_ms,
    t.rpo_actual_ms,
    t.executed_by,
    COUNT(tr.id) as total_components,
    SUM(CASE WHEN tr.passed THEN 1 ELSE 0 END) as passed_components,
    ROUND(AVG(CASE WHEN tr.passed THEN 100.0 ELSE 0.0 END), 2) as success_rate
FROM dr_tests t
LEFT JOIN test_results tr ON t.id = tr.test_id
GROUP BY t.id, t.test_type, t.scenario, t.status, t.start_time, t.end_time, t.rto_actual_ms, t.rpo_actual_ms, t.executed_by;

CREATE VIEW IF NOT EXISTS v_recent_test_results AS
SELECT 
    t.id as test_id,
    t.test_type,
    t.scenario,
    t.status,
    t.start_time,
    tr.component,
    tr.test_name,
    tr.passed,
    tr.execution_time_ms,
    tr.error_message
FROM dr_tests t
JOIN test_results tr ON t.id = tr.test_id
WHERE t.start_time > datetime('now', '-7 days')
ORDER BY t.start_time DESC, tr.id DESC;

CREATE VIEW IF NOT EXISTS v_test_metrics_summary AS
SELECT 
    test_id,
    AVG(CASE WHEN metric_type = 'rto' THEN value END) as avg_rto_ms,
    AVG(CASE WHEN metric_type = 'rpo' THEN value END) as avg_rpo_ms,
    AVG(CASE WHEN metric_type = 'availability' THEN value END) as avg_availability,
    AVG(CASE WHEN metric_type = 'error_rate' THEN value END) as avg_error_rate,
    COUNT(*) as total_metrics,
    SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_metrics
FROM test_metrics
GROUP BY test_id;

-- Insert default test scenarios
INSERT OR IGNORE INTO test_scenarios (scenario_name, test_type, description, test_steps, expected_outcomes, rto_target_ms, rpo_target_ms, prerequisites, cleanup_steps) VALUES
('Complete R2 Outage Simulation', 'full_outage', 'Simulates complete R2 service outage to test failover mechanisms', 
'[
    "Block all R2 operations",
    "Trigger circuit breaker",
    "Verify queue operations",
    "Test user notifications",
    "Restore R2 service",
    "Verify service recovery",
    "Process queued operations"
]',
'[
    "Circuit breaker opens within 30 seconds",
    "Operations are queued successfully",
    "Users receive degradation notifications",
    "Service recovers within RTO target",
    "All queued operations complete successfully"
]',
300000, 60000, '{"backup_available": true, "queue_enabled": true}', '["Clear operation queue", "Reset circuit breaker", "Clear test notifications"]'),

('Partial Service Degradation', 'partial_degradation', 'Tests system behavior under partial R2 service degradation', 
'[
    "Introduce 50% operation failure rate",
    "Monitor circuit breaker behavior",
    "Verify retry mechanisms",
    "Test performance degradation alerts",
    "Restore service gradually"
]',
'[
    "System maintains partial functionality",
    "Circuit breaker enters half-open state",
    "Retry mechanisms activate",
    "Performance alerts are triggered",
    "Service recovers gracefully"
]',
180000, 30000, '{"monitoring_enabled": true, "alerting_enabled": true}', '["Reset failure rate", "Clear performance alerts", "Reset circuit breaker"]'),

('Circuit Breaker Functionality', 'circuit_breaker', 'Tests circuit breaker behavior under various failure conditions', 
'[
    "Trigger failure threshold",
    "Verify circuit breaker opens",
    "Test half-open state behavior",
    "Verify recovery process",
    "Test multiple failure scenarios"
]',
'[
    "Circuit breaker opens at failure threshold",
    "Operations fail fast when open",
    "Half-open state allows test operations",
    "Recovery process works correctly",
    "Multiple failures handled properly"
]',
60000, 0, '{"circuit_breaker_enabled": true, "failure_threshold": 3}', '["Reset circuit breaker state", "Clear failure counters"]'),

('Backup and Restore', 'backup_restore', 'Tests backup creation and restoration processes', 
'[
    "Create test data",
    "Perform full backup",
    "Simulate data loss",
    "Restore from backup",
    "Verify data integrity",
    "Test incremental backup"
]',
'[
    "Backup completes successfully",
    "Data is restored accurately",
    "Integrity checks pass",
    "RTO and RPO targets are met",
    "Incremental backups work correctly"
]',
900000, 300000, '{"backup_enabled": true, "backup_bucket_available": true}', '["Clean test data", "Remove test backups"]'),

('Failover Mechanism', 'failover_mechanism', 'Tests automated failover and recovery mechanisms', 
'[
    "Simulate primary service failure",
    "Trigger automatic failover",
    "Verify secondary operations",
    "Test failback process",
    "Verify data consistency"
]',
'[
    "Failover triggers automatically",
    "Secondary systems handle operations",
    "Failback completes successfully",
    "Data remains consistent",
    "No data loss occurs"
]',
120000, 60000, '{"failover_enabled": true, "secondary_systems_available": true}', '["Reset failover state", "Restore primary systems"]'),

('Performance Benchmark', 'performance_benchmark', 'Benchmarks system performance under normal and stress conditions', 
'[
    "Establish baseline metrics",
    "Run stress tests",
    "Measure response times",
    "Test throughput limits",
    "Verify performance thresholds"
]',
'[
    "Baseline metrics are established",
    "Stress tests complete successfully",
    "Response times meet SLAs",
    "Throughput meets requirements",
    "Performance thresholds are maintained"
]',
0, 0, '{"monitoring_enabled": true, "load_testing_enabled": true}', '["Reset performance counters", "Clear test load"]);

-- Insert default test schedules
INSERT OR IGNORE INTO test_schedules (scenario_id, schedule_name, cron_expression, enabled) VALUES
((SELECT id FROM test_scenarios WHERE scenario_name = 'Complete R2 Outage Simulation'), 'Weekly Full Outage Test', '0 2 * * 1', 1),
((SELECT id FROM test_scenarios WHERE scenario_name = 'Partial Service Degradation'), 'Daily Degradation Test', '0 3 * * *', 1),
((SELECT id FROM test_scenarios WHERE scenario_name = 'Circuit Breaker Functionality'), 'Hourly Circuit Breaker Test', '0 */6 * * *', 1),
((SELECT id FROM test_scenarios WHERE scenario_name = 'Backup and Restore'), 'Weekly Backup Test', '0 1 * * 0', 1),
((SELECT id FROM test_scenarios WHERE scenario_name = 'Performance Benchmark'), 'Daily Performance Test', '0 4 * * *', 1);

-- Create triggers for automatic cleanup
CREATE TRIGGER IF NOT EXISTS cleanup_old_test_logs
AFTER INSERT ON test_logs
BEGIN
    DELETE FROM test_logs 
    WHERE timestamp < datetime('now', '-30 days')
    AND id NOT IN (
        SELECT id FROM test_logs 
        ORDER BY timestamp DESC 
        LIMIT 100000
    );
END;

CREATE TRIGGER IF NOT EXISTS cleanup_old_test_results
AFTER INSERT ON test_results
BEGIN
    DELETE FROM test_results 
    WHERE created_at < datetime('now', '-90 days')
    AND test_id NOT IN (
        SELECT id FROM dr_tests 
        WHERE start_time > datetime('now', '-90 days')
    );
END;

-- Create trigger to update test status
CREATE TRIGGER IF NOT EXISTS update_test_status
AFTER INSERT ON test_results
BEGIN
    UPDATE dr_tests 
    SET status = CASE 
        WHEN (SELECT COUNT(*) FROM test_results WHERE test_id = NEW.test_id AND passed = 0) > 0 THEN 'failed'
        WHEN (SELECT COUNT(*) FROM test_results WHERE test_id = NEW.test_id) >= 
             (SELECT json_array_length(test_steps) FROM test_scenarios WHERE scenario_name = 
              (SELECT scenario FROM dr_tests WHERE id = NEW.test_id)) THEN 'completed'
        ELSE 'running'
    END,
    end_time = CASE 
        WHEN status IN ('completed', 'failed') THEN datetime('now')
        ELSE end_time
    END
    WHERE id = NEW.test_id AND status NOT IN ('completed', 'failed', 'cancelled');
END;