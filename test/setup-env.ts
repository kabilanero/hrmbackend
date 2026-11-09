// Runs before the app is imported. Requires a reachable PostgreSQL with the schema migrated.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://postgres@localhost:54329/hrm';
process.env.DIRECT_URL ??= process.env.DATABASE_URL;
process.env.SUPABASE_URL = 'https://test-project.supabase.co';
process.env.SUPABASE_ANON_KEY = 'anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
process.env.THROTTLE_LIMIT = '100000';
process.env.APP_TIMEZONE = 'Asia/Kolkata';
