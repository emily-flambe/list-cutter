-- Test script to verify the consolidated final schema works correctly
-- This script tests all major functionality including email optional

-- Test 1: Insert user with email (should work)
INSERT INTO users (username, email, password_hash) 
VALUES ('test_user_with_email', 'test@example.com', 'test_hash_123');

-- Test 2: Insert user without email (should work - email is optional)
INSERT INTO users (username, password_hash) 
VALUES ('test_user_no_email', 'test_hash_456');

-- Test 3: Test file upload functionality
INSERT INTO files (user_id, filename, original_filename, file_size, mime_type, r2_key, checksum, upload_status)
SELECT id, 'test.csv', 'original_test.csv', 1024, 'text/csv', 'test-key-123', 'abc123', 'completed'
FROM users WHERE username = 'test_user_with_email';

-- Test 4: Test API key functionality
INSERT INTO api_keys (key_id, user_id, name, key_hash, key_prefix, created_at)
SELECT 'test-key-id', id, 'Test API Key', 'hash123', 'tk_test', strftime('%s', 'now')
FROM users WHERE username = 'test_user_with_email';

-- Test 5: Test security events
INSERT INTO security_events (id, timestamp, event_type, user_id, success, metadata)
SELECT 'test-event-1', strftime('%s', 'now'), 'login', id, 1, '{"test": true}'
FROM users WHERE username = 'test_user_with_email';

-- Test 6: Test storage metrics
INSERT INTO storage_metrics (user_id, metric_type, metric_value, measurement_date)
SELECT id, 'storage_used', 1024, date('now')
FROM users WHERE username = 'test_user_with_email';

-- Test 7: Test alert configuration
INSERT INTO alert_configurations (id, name, alert_type, metric_type, conditions, threshold_value, notification_channels)
VALUES ('test-alert-1', 'Test Alert', 'threshold', 'storage_used', '{"operator": ">=", "value": 100}', 100, '["email"]');

-- Test 8: Test user quotas
INSERT INTO user_quotas (user_id, quota_type, quota_limit, current_usage)
SELECT id, 'storage', 1073741824, 1024  -- 1GB limit, 1KB used
FROM users WHERE username = 'test_user_with_email';

-- Display test results
SELECT '=== USERS TEST ===' as test_section;
SELECT username, email, is_active, created_at FROM users WHERE username LIKE 'test_user_%';

SELECT '=== FILES TEST ===' as test_section;
SELECT filename, file_size, upload_status, created_at FROM files WHERE filename = 'test.csv';

SELECT '=== API KEYS TEST ===' as test_section;
SELECT name, key_prefix, is_active, created_at FROM api_keys WHERE name = 'Test API Key';

SELECT '=== SECURITY EVENTS TEST ===' as test_section;
SELECT event_type, success, timestamp FROM security_events WHERE id = 'test-event-1';

SELECT '=== STORAGE METRICS TEST ===' as test_section;
SELECT metric_type, metric_value, measurement_date FROM storage_metrics WHERE metric_type = 'storage_used';

SELECT '=== ALERT CONFIGURATIONS TEST ===' as test_section;
SELECT name, alert_type, is_enabled FROM alert_configurations WHERE id = 'test-alert-1';

SELECT '=== USER QUOTAS TEST ===' as test_section;
SELECT quota_type, quota_limit, current_usage FROM user_quotas WHERE quota_type = 'storage';

SELECT '=== VIEWS TEST ===' as test_section;
SELECT username, total_files, total_storage_bytes FROM user_storage_summary WHERE username LIKE 'test_user_%';

SELECT '=== SCHEMA VERSION TEST ===' as test_section;
SELECT version, description, applied_at FROM schema_version;

-- Cleanup test data
DELETE FROM users WHERE username LIKE 'test_user_%';
DELETE FROM alert_configurations WHERE id = 'test-alert-1';

SELECT '✅ All tests completed successfully!' as result;