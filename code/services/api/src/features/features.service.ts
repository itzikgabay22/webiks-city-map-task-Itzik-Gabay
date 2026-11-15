import { Injectable } from '@nestjs/common';
import type { Geometry } from 'geojson';
import { Caller } from '../auth/caller';
import { config } from '../config';
import { CacheService } from '../infra/cache.service';
import { DatabaseService } from '../infra/database.service';
import { layerSource, readableBy } from '../layers/layer-sources';

export interface ClickFeature {
  layer: string;
  id: number;
  properties: Record<string, unknown>;
  geometry: Geometry;
}

export interface ClickResult {
  lon: number;
  lat: number;
  layers: string[];
  features: ClickFeature[];
}

const MAX_FEATURES_PER_LAYER = 25;

@Injectable()
export class FeaturesService {
  constructor(private readonly db: DatabaseService, private readonly cache: CacheService) {}

  /** Features under a map click, across the requested layers the caller may read. */
  async at(lon: number, lat: number, layers: string[], caller: Caller): Promise<ClickResult> {
    const key = `features:${lon}:${lat}:${layers.join(',')}`;
    const cached = await this.cache.get<ClickResult>(key);
    if (cached) return cached;

    const parts = layers
      .filter((id) => layerSource(id))
      .map((id) => {
        const source = layerSource(id)!;
        const match = source.pointRadiusDeg
          ? `ST_DWithin(t.geom, pt.geom, ${source.pointRadiusDeg})`
          : 'ST_Intersects(t.geom, pt.geom)';
        return `(SELECT '${id}' AS layer, t.id, ${source.properties} AS properties, ST_AsGeoJSON(t.geom)::json AS geometry
                 FROM ${source.table} t, layers l, pt
                 WHERE l.id = '${id}' AND ${readableBy('$3')} AND ${match}
                 ORDER BY t.id
                 LIMIT ${MAX_FEATURES_PER_LAYER})`;
      });

    const features = parts.length
      ? await this.db.query<ClickFeature>(
          `WITH pt AS (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326) AS geom)
           ${parts.join('\nUNION ALL\n')}`,
          [lon, lat, caller],
        )
      : [];

    const result: ClickResult = { lon, lat, layers, features };
    await this.cache.set(key, result, config.cacheTtlSeconds.features);
    return result;
  }
}
