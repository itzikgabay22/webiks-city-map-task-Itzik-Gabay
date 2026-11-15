import { Body, Controller, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { config } from '../config';
import { DatabaseService } from '../infra/database.service';
import { issueToken } from './token';

@Controller('auth')
export class AuthController {
  constructor(private readonly db: DatabaseService) {}

  /** Local and staging environments only: issues a token for a seeded user. */
  @Post('dev-login')
  @HttpCode(200)
  async devLogin(@Body() body: { username?: string }) {
    const username = String(body?.username ?? '').trim();
    const rows = await this.db.query<{ username: string }>('SELECT username FROM users WHERE username = $1', [username]);
    if (rows.length === 0) throw new UnauthorizedException('unknown user');
    return { token: issueToken(username, config.jwtSecret), username };
  }
}
