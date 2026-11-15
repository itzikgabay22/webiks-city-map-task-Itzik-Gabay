import { Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import simplify from '@turf/simplify';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { Caller } from '../auth/caller';
import { BBox } from '../common/geo';
import { config } from '../config';
import { CacheService } from '../infra/cache.service';
import { DatabaseService } from '../infra/database.service';
import { LAYER_SOURCES, layerSource, readableBy } from './layer-sources';

const SUMMARY_SQL: Record<string, string> = {
  parcels: `
    SELECT p.land_use AS "landUse",
           count(DISTINCT p.id)::int AS parcels,
           round(avg(p.area_m2)) AS "avgAreaM2",
           percentile_cont(0.5) WITHIN GROUP (ORDER BY p.area_m2) AS "medianAreaM2",
           percentile_cont(0.95) WITHIN GROUP (ORDER BY p.area_m2) AS "p95AreaM2",
           round(sum(ST_Area(p.geom::geography)) / 1e6) AS "totalAreaKm2",
           count(a.id)::int AS addresses
    FROM parcels p
    LEFT JOIN addresses a ON a.parcel_id = p.id
    GROUP BY p.land_use
    ORDER BY p.land_use`,
  admin_boundaries: `
    SELECT region,
           count(*)::int AS districts,
           sum(population)::int AS population,
           round(sum(ST_Area(geom::geography)) / 1e6) AS "areaKm2",
           round(sum(ST_Perimeter(geom::geography)) / 1e3) AS "boundaryKm"
    FROM admin_boundaries
    GROUP BY region
    ORDER BY region`,
  addresses: `
    SELECT locality,
           count(*)::int AS addresses,
           count(DISTINCT street)::int AS streets,
           min(postcode) AS "firstPostcode",
           max(postcode) AS "lastPostcode"
    FROM addresses
    GROUP BY locality
    ORDER BY locality`,
  announcements: `
    SELECT dataset_version AS "datasetVersion", kind, count(*)::int AS features, max(published_at) AS "publishedAt"
    FROM announcements
    GROUP BY dataset_version, kind
    ORDER BY max(published_at) DESC, kind`,
  planning_drafts: `
    SELECT status, count(*)::int AS drafts, round(sum(ST_Area(geom::geography))) AS "areaM2"
    FROM planning_drafts
    GROUP BY status
    ORDER BY status`,
};

const VISIBLE_LAYERS_SQL = `
  WITH caller AS (
    SELECT $1::text AS username
  ),
  owned AS (
    SELECT l.id FROM layers l JOIN caller c ON l.owner = c.username
  ),
  shared AS (
    SELECT s.layer_id AS id FROM layer_shares s JOIN caller c ON s.username = c.username
  ),
  visible AS (
    SELECT id FROM layers WHERE is_public
    UNION
    SELECT id FROM owned
    UNION
    SELECT id FROM shared
  ),
  share_counts AS (
    SELECT s.layer_id, count(*) AS shared_with
    FROM layer_shares s
    JOIN visible v ON v.id = s.layer_id
    GROUP BY s.layer_id
  )
  SELECT l.id,
         l.title,
         l.geometry_type AS "geometryType",
         l.is_public AS "isPublic",
         l.updated_at AS "updatedAt",
         (l.owner IS NOT NULL AND l.owner = (SELECT username FROM caller)) AS "isOwner",
         COALESCE(sc.shared_with, 0)::int AS "sharedWith"
  FROM layers l
  JOIN visible v ON v.id = l.id
  LEFT JOIN share_counts sc ON sc.layer_id = l.id
  ORDER BY l.is_public DESC, l.title`;

const EXPORT_LIMIT = 2000;

export interface LayerSummary {
  layer: string;
  generatedAt: string;
  rows: Record<string, unknown>[];
}

@Injectable()
export class LayersService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LayersService.name);

  constructor(private readonly db: DatabaseService, private readonly cache: CacheService) {}

  listVisible(caller: Caller) {
    return this.db.query(VISIBLE_LAYERS_SQL, [caller]);
  }

  async assertReadable(id: string, caller: Caller): Promise<void> {
    if (!layerSource(id)) throw new NotFoundException(`layer ${id} not found`);
    const rows = await this.db.query(`SELECT 1 FROM layers l WHERE l.id = $1 AND ${readableBy('$2')}`, [id, caller]);
    if (rows.length === 0) throw new NotFoundException(`layer ${id} not found`);
  }

  async summary(id: string, caller: Caller): Promise<LayerSummary> {
    await this.assertReadable(id, caller);
    const cached = await this.cache.get<LayerSummary>(`layer:summary:${id}`);
    return cached ?? this.computeSummary(id);
  }

  async exportGeoJson(id: string, caller: Caller, bbox: BBox, tolerance: number): Promise<FeatureCollection> {
    await this.assertReadable(id, caller);
    const source = layerSource(id)!;
    const rows = await this.db.query<{ id: number; properties: Record<string, unknown>; geometry: Geometry }>(
      `SELECT t.id, ${source.properties} AS properties, ST_AsGeoJSON(t.geom)::json AS geometry
       FROM ${source.table} t
       WHERE t.geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
       ORDER BY t.id
       LIMIT ${EXPORT_LIMIT}`,
      bbox,
    );
    const collection: FeatureCollection = {
      type: 'FeatureCollection',
      features: rows.map((r): Feature => ({ type: 'Feature', id: r.id, properties: r.properties, geometry: r.geometry })),
    };
    return tolerance > 0 ? simplify(collection, { tolerance, highQuality: true, mutate: true }) : collection;
  }

  /** Pre-computes every layer summary so the first map loads after a deploy are fast. */
  async onApplicationBootstrap(): Promise<void> {
    const started = Date.now();
    for (const id of Object.keys(LAYER_SOURCES)) {
      try {
        await this.computeSummary(id);
      } catch (err) {
        this.logger.warn(`summary warm-up failed for ${id}: ${(err as Error).message}`);
      }
    }
    this.logger.log(`layer summaries warmed in ${Date.now() - started} ms`);
  }

  private async computeSummary(id: string): Promise<LayerSummary> {
    const summary: LayerSummary = {
      layer: id,
      generatedAt: new Date().toISOString(),
      rows: await this.db.query(SUMMARY_SQL[id]),
    };
    await this.cache.set(`layer:summary:${id}`, summary, config.cacheTtlSeconds.summary);
    return summary;
  }
}
