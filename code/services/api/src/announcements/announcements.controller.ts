import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { config } from '../config';
import { CacheService } from '../infra/cache.service';
import { DatabaseService } from '../infra/database.service';

interface LatestAnnouncement {
  version: string | null;
  publishedAt: string | null;
  features: unknown[];
}

@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly db: DatabaseService, private readonly cache: CacheService) {}

  /** The most recently published official dataset. Public and CDN-cacheable. */
  @Get('latest')
  async latest(@Res({ passthrough: true }) res: Response): Promise<LatestAnnouncement> {
    const ttl = config.cacheTtlSeconds.announcements;
    res.setHeader('Cache-Control', `public, max-age=${ttl}`);

    const cached = await this.cache.get<LatestAnnouncement>('announcements:latest');
    if (cached) return cached;

    const rows = await this.db.query<{ dataset_version: string; published_at: Date; feature: unknown }>(
      `WITH latest AS (
         SELECT dataset_version, max(published_at) AS published_at
         FROM announcements
         GROUP BY dataset_version
         ORDER BY max(published_at) DESC
         LIMIT 1
       )
       SELECT l.dataset_version, l.published_at,
              json_build_object('type', 'Feature', 'id', a.id,
                                'properties', jsonb_build_object('kind', a.kind, 'title', a.title) || a.properties,
                                'geometry', ST_AsGeoJSON(a.geom)::json) AS feature
       FROM latest l
       JOIN announcements a USING (dataset_version)
       ORDER BY a.id`,
    );

    const latest: LatestAnnouncement = {
      version: rows[0]?.dataset_version ?? null,
      publishedAt: rows[0]?.published_at?.toISOString() ?? null,
      features: rows.map((r) => r.feature),
    };
    await this.cache.set('announcements:latest', latest, ttl);
    return latest;
  }
}
