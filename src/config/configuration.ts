export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  apiDefaultVersion: string;
  timezone: string;
  corsOrigins: string[];
  swaggerEnabled: boolean;
  throttle: { ttlSeconds: number; limit: number };
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
    jwtSecret?: string;
    storageBucket: string;
  };
}

const bool = (v: string | undefined, def: boolean) =>
  v === undefined ? def : ['true', '1', 'yes'].includes(v.toLowerCase());

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  apiDefaultVersion: process.env.API_DEFAULT_VERSION ?? '1',
  timezone: process.env.APP_TIMEZONE ?? 'Asia/Kolkata',
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  swaggerEnabled: bool(process.env.SWAGGER_ENABLED, true),
  throttle: {
    ttlSeconds: parseInt(process.env.THROTTLE_TTL_SECONDS ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '120', 10),
  },
  supabase: {
    url: process.env.SUPABASE_URL as string,
    anonKey: process.env.SUPABASE_ANON_KEY as string,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    jwtSecret: process.env.SUPABASE_JWT_SECRET || undefined,
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? 'hrm-files',
  },
});





