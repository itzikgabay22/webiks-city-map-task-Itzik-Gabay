/** Physical source for each layer id. Layer ids are never interpolated from user input directly. */
export interface LayerSource {
  table: string;
  /** SQL expression (alias `t`) producing the feature properties as jsonb. */
  properties: string;
  /** Point layers are matched within a small radius instead of by intersection. */
  pointRadiusDeg?: number;
  /**
   * How map-click responses encode geometry for this layer.
   * - full: ST_AsGeoJSON(geom)
   * - envelope: bounding box only (survey-resolution coastlines)
   * - simplify:<deg>: ST_SimplifyPreserveTopology
   */
  clickGeometry?: 'full' | 'envelope' | `simplify:${number}`;
}

export const LAYER_SOURCES: Record<string, LayerSource> = {
  parcels: {
    table: 'parcels',
    properties: `jsonb_build_object('parcelCode', t.parcel_code, 'landUse', t.land_use, 'areaM2', t.area_m2)`,
  },
  addresses: {
    table: 'addresses',
    properties: `jsonb_build_object('houseNumber', t.house_number, 'street', t.street, 'locality', t.locality, 'postcode', t.postcode)`,
    pointRadiusDeg: 0.0005,
  },
  admin_boundaries: {
    table: 'admin_boundaries',
    properties: `jsonb_build_object('name', t.name, 'region', t.region, 'population', t.population)`,
    // Envelope only: simplifying 150k–300k coastal vertices still burned hundreds of ms
    // per click under peak and helped tip PostGIS into crash loops at ×10.
    clickGeometry: 'envelope',
  },
  announcements: {
    table: 'announcements',
    properties: `jsonb_build_object('kind', t.kind, 'title', t.title, 'datasetVersion', t.dataset_version) || t.properties`,
  },
  planning_drafts: {
    table: 'planning_drafts',
    properties: `jsonb_build_object('title', t.title, 'status', t.status, 'notes', t.notes)`,
  },
};

export function layerSource(id: string): LayerSource | undefined {
  return Object.prototype.hasOwnProperty.call(LAYER_SOURCES, id) ? LAYER_SOURCES[id] : undefined;
}

/** WHERE fragment granting read access to layer row `l` for the caller bound to `param`. */
export function readableBy(param: string): string {
  return `(l.is_public OR l.owner = ${param} OR EXISTS (
    SELECT 1 FROM layer_shares s WHERE s.layer_id = l.id AND s.username = ${param}))`;
}
