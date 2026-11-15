import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';
import { config } from '../config';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: config.databaseUrl,
    max: config.dbPoolMax,
    idleTimeoutMillis: 30_000,
    application_name: 'citymap-api',
  });
  private readonly logger = new Logger(DatabaseService.name);

  constructor() {
    // Idle clients can be dropped by the server (restart, failover); the pool replaces them.
    this.pool.on('error', (err) => this.logger.warn(`idle database connection closed: ${err.message}`));
  }

  async query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.pool.query<T>(text, params);
    return result.rows;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
