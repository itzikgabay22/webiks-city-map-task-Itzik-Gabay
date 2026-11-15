import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../infra/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  /** Liveness: process is up. Must not touch Postgres (slow queries must not kill the pod). */
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  /** Readiness / legacy probe: includes a cheap DB ping. */
  @Get()
  async check() {
    try {
      await this.db.query('SELECT 1');
    } catch (err) {
      throw new ServiceUnavailableException({ status: 'error', db: (err as Error).message });
    }
    return { status: 'ok', db: 'up' };
  }
}
