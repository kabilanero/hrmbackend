/**
 * Fail fast on boot when required configuration is missing or malformed.
 */
const REQUIRED = [
  'DATABASE_URL',
  'DIRECT_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

export function validateEnv(config: Record<string, unknown>) {
  const missing = REQUIRED.filter((k) => !config[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  try {
    new URL(String(config.SUPABASE_URL));
  } catch {
    throw new Error('SUPABASE_URL must be a valid URL');
  }
  const port = Number(config.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT must be a positive integer');
  }
  return config;
}


