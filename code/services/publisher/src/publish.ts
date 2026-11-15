import { Pool } from 'pg';
import { buildRaceWeekendDataset } from './dataset';

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') throw new Error(`${name} is required`);
  return value;
}

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: env('DATABASE_URL'),
    max: Number(env('DB_POOL_MAX', '10')),
    application_name: 'citymap-publisher',
  });

  const version = env('DATASET_VERSION', `grand-prix-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}`);
  const features = buildRaceWeekendDataset(env('RACE_WEEKEND_START', '2026-10-30'));
  const started = Date.now();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const publishedAt = new Date();
    for (const f of features) {
      await client.query(
        `INSERT INTO announcements (dataset_version, kind, title, properties, published_at, geom)
         VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_GeomFromGeoJSON($6), 4326))`,
        [version, f.kind, f.title, JSON.stringify(f.properties), publishedAt, JSON.stringify(f.geometry)],
      );
    }
    await client.query(`UPDATE layers SET updated_at = $1 WHERE id = 'announcements'`, [publishedAt]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }

  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    level: 'info',
    msg: 'dataset published',
    version,
    features: features.length,
    durationMs: Date.now() - started,
  }));
}

main().catch((err) => {
  console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg: 'publish failed', error: String(err) }));
  process.exit(1);
});
