import { Injectable } from '@nestjs/common';
import type { Geometry } from 'geojson';
import { parseAddressQuery } from '../common/address';
import { likePrefix } from '../common/sql';
import { DatabaseService } from '../infra/database.service';

export interface AddressMatch {
  id: number;
  houseNumber: number;
  street: string;
  locality: string;
  postcode: string;
  lon: number;
  lat: number;
  score: number;
  parcel: { code: string; landUse: string; areaM2: number; geometry: Geometry } | null;
}

export interface AddressSearchResult {
  query: string;
  matches: AddressMatch[];
}

const MAX_MATCHES = 60;

@Injectable()
export class SearchService {
  /** Address data changes a few times a year; resolved queries are kept for the life of the process. */
  private readonly resolved = new Map<string, AddressSearchResult>();

  constructor(private readonly db: DatabaseService) {}

  async searchAddress(query: string): Promise<AddressSearchResult> {
    const normalised = query.trim().toLowerCase().replace(/\s+/g, ' ');
    const { street, houseNumber } = parseAddressQuery(normalised);
    const known = this.resolved.get(normalised);
    if (known) return known;

    const rows = await this.db.query<{
      id: number; house_number: number; street: string; locality: string; postcode: string;
      lon: number; lat: number; score: number;
      parcel_code: string | null; land_use: string | null; area_m2: string | null; parcel_geometry: Geometry | null;
    }>(
      `SELECT a.id, a.house_number, a.street, a.locality, a.postcode,
              ST_X(a.geom) AS lon, ST_Y(a.geom) AS lat,
              similarity(a.search_text, $1) AS score,
              p.parcel_code, p.land_use, p.area_m2, ST_AsGeoJSON(p.geom)::json AS parcel_geometry
       FROM addresses a
       LEFT JOIN parcels p ON p.id = a.parcel_id
       WHERE a.search_text LIKE $2
       ORDER BY abs(a.house_number - COALESCE($3::int, 0)), a.locality, a.id
       LIMIT ${MAX_MATCHES}`,
      [normalised, likePrefix(street), houseNumber],
    );

    const result: AddressSearchResult = {
      query: normalised,
      matches: rows.map((r) => ({
        id: r.id,
        houseNumber: r.house_number,
        street: r.street,
        locality: r.locality,
        postcode: r.postcode,
        lon: r.lon,
        lat: r.lat,
        score: Number(r.score),
        parcel: r.parcel_code
          ? { code: r.parcel_code, landUse: r.land_use!, areaM2: Number(r.area_m2), geometry: r.parcel_geometry! }
          : null,
      })),
    };
    this.resolved.set(normalised, result);
    return result;
  }
}
