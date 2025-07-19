-- Add role column to users table for proper access control
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';

-- Update existing admin users
UPDATE users 
SET role = 'admin' 
WHERE email LIKE '%admin%' OR email = 'emily@example.com';

-- Create index for role queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);