function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value)) throw new Error(`${name} must be an integer, got "${raw}"`);
  return value;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export const config = {
  port: int('PORT', 3000),
  databaseUrl: required('DATABASE_URL'),
  dbPoolMax: int('DB_POOL_MAX', 20),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwtSecret: required('JWT_SECRET'),
  cacheTtlSeconds: {
    features: int('FEATURES_CACHE_TTL', 60),
    summary: int('SUMMARY_CACHE_TTL', 600),
    // Keep short so a published race-weekend dataset is visible within seconds,
    // even before a CDN invalidation lands.
    announcements: int('ANNOUNCEMENTS_CACHE_TTL', 15),
  },
  partnerRequestsPerMinute: int('PARTNER_RATE_LIMIT', 1000),
  defaultClickLayers: (process.env.DEFAULT_CLICK_LAYERS ?? 'parcels,addresses,admin_boundaries').split(','),
};

export type AppConfig = typeof config;
