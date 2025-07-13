-- Test script to verify email is optional after migration
-- This should succeed if the migration worked correctly

-- Test 1: Insert user with email (should work)
INSERT INTO users (username, email, password_hash) 
VALUES ('test_user_with_email', 'test@example.com', 'test_hash_123');

-- Test 2: Insert user without email (should work after migration)
INSERT INTO users (username, password_hash) 
VALUES ('test_user_no_email', 'test_hash_456');

-- Test 3: Check the schema
PRAGMA table_info(users);

-- Test 4: Verify the test data
SELECT id, username, email, created_at FROM users WHERE username LIKE 'test_user_%';

-- Cleanup test data
DELETE FROM users WHERE username LIKE 'test_user_%';