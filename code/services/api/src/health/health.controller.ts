import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../infra/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

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
