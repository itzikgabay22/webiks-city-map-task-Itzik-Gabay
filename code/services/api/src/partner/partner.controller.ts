import {
  BadRequestException, CanActivate, Controller, ExecutionContext, Get, Injectable, NotFoundException, Query,
  UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { parseBbox } from '../common/geo';
import { DatabaseService } from '../infra/database.service';
import { layerSource } from '../layers/layer-sources';

const MAX_PARTNER_FEATURES = 1000;

@Injectable()
export class PartnerKeyGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const key = ctx.switchToHttp().getRequest<Request>().header('x-api-key');
    if (!key) throw new UnauthorizedException('X-Api-Key header is required');
    const hash = createHash('sha256').update(key).digest('hex');
    const rows = await this.db.query('SELECT id FROM partners WHERE api_key_hash = $1 AND active', [hash]);
    if (rows.length === 0) throw new UnauthorizedException('unknown API key');
    return true;
  }
}

@Controller('partner/v1')
@UseGuards(PartnerKeyGuard)
export class PartnerController {
  constructor(private readonly db: DatabaseService) {}

  /** Public layers only, in a bounding box. */
  @Get('features')
  async features(@Query('bbox') rawBbox: string | undefined, @Query('layer') layer: string | undefined) {
    const bbox = parseBbox(rawBbox);
    if (!bbox) throw new BadRequestException('bbox=minLon,minLat,maxLon,maxLat is required');
    const source = layer ? layerSource(layer) : undefined;
    if (!layer || !source) throw new NotFoundException('unknown layer');

    const rows = await this.db.query(
      `SELECT t.id, ${source.properties} AS properties, ST_AsGeoJSON(t.geom, 6)::json AS geometry
       FROM ${source.table} t
       JOIN layers l ON l.id = $5 AND l.is_public
       WHERE t.geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
       ORDER BY t.id
       LIMIT ${MAX_PARTNER_FEATURES}`,
      [...bbox, layer],
    );
    return { type: 'FeatureCollection', features: rows.map((r) => ({ type: 'Feature', ...r })) };
  }
}
