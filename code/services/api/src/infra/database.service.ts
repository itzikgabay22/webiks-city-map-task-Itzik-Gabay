import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';
import { config } from '../config';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: config.databaseUrl,
    max: config.dbPoolMax,
    idleTimeoutMillis: 30_000,
    // Fail fast under overload so readiness probes and callers are not stuck
    // behind a saturated PostGIS (seen as 30s+ request queues at peak ×10/×50).
    connectionTimeoutMillis: 2_000,
    application_name: 'citymap-api',
  });
  private readonly logger = new Logger(DatabaseService.name);

  constructor() {
    // Idle clients can be dropped by the server (restart, failover); the pool replaces them.
    this.pool.on('error', (err) => this.logger.warn(`idle database connection closed: ${err.message}`));
    this.pool.on('connect', (client) => {
      void client.query('SET statement_timeout = 5000').catch((err: Error) => {
        this.logger.warn(`failed to set statement_timeout: ${err.message}`);
      });
    });
  }

  async query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.pool.query<T>(text, params);
    return result.rows;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
