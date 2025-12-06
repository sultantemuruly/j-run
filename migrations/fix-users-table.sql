-- Drop the existing users table and recreate with new schema
-- WARNING: This will delete all existing data in the users table!

DROP TABLE IF EXISTS users CASCADE;

-- The table will be recreated by drizzle-kit push with the new schema

