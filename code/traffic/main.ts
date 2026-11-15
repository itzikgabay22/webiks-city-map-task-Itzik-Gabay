/**
 * CityMap traffic generator.
 *
 *   SCENARIO   baseline | peak | soak            (default baseline)
 *   MULTIPLIER web traffic multiplier for peak     (default 10)
 *   DURATION   k6 duration string                  (default 10m)
 *   BASE_URL   ingress base URL                    (default http://localhost:8080)
 *   MAX_VUS    cap on concurrent virtual users     (default 400)
 *   SEED       random seed                         (default 20261030)
 *
 * Partner traffic is steady and does not scale with MULTIPLIER.
 */
import http from 'k6/http';
import { CityMapClient } from '../services/sdk/src/client.ts';
import { k6Transport } from '../services/sdk/src/transports/k6.ts';
import { metered, recordLatency } from './lib/metered.ts';
import { between, iterationRandom, pick } from './lib/random.ts';
import { writeSummary } from './lib/summary.ts';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const API = `${BASE_URL}/api`;
const SCENARIO = __ENV.SCENARIO || 'baseline';
const MULTIPLIER = SCENARIO === 'peak' ? Number(__ENV.MULTIPLIER || 10) : 1;
const DURATION = __ENV.DURATION || (SCENARIO === 'soak' ? '20m' : SCENARIO === 'peak' ? '5m' : '10m');
const MAX_VUS = Number(__ENV.MAX_VUS || 400);

const PARTNER_KEYS = {
  transit: 'velt-transit-2b81c4e9d7a6f350',
  pitlane: 'pitlane-live-91d0a3f5e2c8b764',
};

const transport = metered(k6Transport);
const anonymous = new CityMapClient({ baseUrl: API, transport });

// Requests per second at MULTIPLIER = 1.
const WEB_RATES: Record<string, number> = {
  page_load: 1.5,
  map_click: 5,
  tiles: 10,
  planner_session: 0.5,
  address_search: 8,
  geojson_export: 1 / 30,
};
const PARTNER_RATES: Record<string, number> = {
  partner_transit: 14,
  partner_pitlane: 7,
};

function arrival(perSecond: number, fn: string) {
  const perMinute = Math.max(1, Math.round(perSecond * 60));
  return {
    executor: 'constant-arrival-rate',
    exec: fn,
    rate: perMinute,
    timeUnit: '1m',
    duration: DURATION,
    preAllocatedVUs: Math.min(MAX_VUS, Math.ceil(perSecond * 2) + 2),
    maxVUs: Math.min(MAX_VUS, Math.ceil(perSecond * 30) + 5),
  };
}

export const options = {
  discardResponseBodies: false,
  scenarios: {
    ...Object.fromEntries(Object.entries(WEB_RATES).map(([name, r]) => [name, arrival(r * MULTIPLIER, name)])),
    ...Object.fromEntries(Object.entries(PARTNER_RATES).map(([name, r]) => [name, arrival(r, name)])),
  },
  summaryTrendStats: ['med', 'p(95)', 'p(99)', 'max', 'count'],
};

// Fictional extent of Veloria and the northern coastal districts.
const EXTENT = { minX: 2.0, minY: -44.0, maxX: 6.0, maxY: -40.0 };
const NORTH = { minX: 3.2, minY: -40.8, maxX: 4.8, maxY: -40.0 };
const PUBLIC_LAYERS = ['parcels', 'addresses', 'admin_boundaries', 'announcements'];
const STREETS = ['Olive', 'Harbour', 'Market', 'Chapel', 'Mill', 'Station', 'Garden', 'Quarry', 'Lantern', 'Cedar',
  'Fountain', 'Bridge', 'Orchard', 'Saltmarsh', 'Copper', 'Signal', 'Meadow', 'Granary', 'Beacon', 'Willow',
  'Circuit', 'Grandstand', 'Chicane', 'Paddock', 'Hairpin', 'Tannery', 'Weaver', 'Foundry', 'Ropewalk', 'Clocktower'];
const STREET_TYPES = ['street', 'road', 'lane', 'avenue', 'way'];

export function setup() {
  const tokens: Record<string, string> = {};
  for (const user of ['alice', 'bob']) {
    const res = http.post(`${API}/auth/dev-login`, JSON.stringify({ username: user }), {
      headers: { 'content-type': 'application/json' },
    });
    tokens[user] = res.json('token') as string;
  }
  return { tokens };
}

function clickPoint(random: () => number): [number, number] {
  const box = random() < 0.2 ? NORTH : EXTENT;
  return [between(random, box.minX, box.maxX), between(random, box.minY, box.maxY)];
}

function ignore(): void {
  // Failures are recorded by the metered transport.
}

export async function page_load() {
  await Promise.all([
    anonymous.layers().catch(ignore),
    ...PUBLIC_LAYERS.map((id) => anonymous.layerSummary(id).catch(ignore)),
    anonymous.latestAnnouncement().catch(ignore),
  ]);
}

export async function map_click() {
  const [lon, lat] = clickPoint(iterationRandom());
  await anonymous.featuresAt(lon, lat).catch(ignore);
}

export function tiles() {
  const random = iterationRandom();
  const layer = random() < 0.8 ? 'parcels' : 'announcements';
  const z = layer === 'parcels' ? 12 + Math.floor(random() * 3) : 10 + Math.floor(random() * 4);
  const n = 2 ** z;
  const lon = between(random, EXTENT.minX, EXTENT.maxX, 4);
  const lat = between(random, EXTENT.minY, EXTENT.maxY, 4);
  const x = Math.floor(((lon + 180) / 360) * n);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  const res = http.get(`${BASE_URL}/tiles/${layer}/${z}/${x}/${y}`, { tags: { endpoint: 'tiles', name: 'tiles' } });
  recordLatency('tiles', res.timings.duration);
}

export async function planner_session(data: { tokens: Record<string, string> }) {
  const random = iterationRandom();
  const user = random() < 0.6 ? 'alice' : 'bob';
  const client = anonymous.withToken(data.tokens[user]);
  const [lon, lat] = clickPoint(random);
  await client.layers().catch(ignore);
  await client.featuresAt(lon, lat, ['parcels', 'planning_drafts']).catch(ignore);
}

export async function address_search() {
  const random = iterationRandom();
  const q = `${pick(random, STREETS)} ${pick(random, STREET_TYPES)} ${1 + Math.floor(random() * 240)}`;
  await anonymous.searchAddress(q).catch(ignore);
}

export async function geojson_export() {
  const random = iterationRandom();
  if (random() < 0.5) {
    await anonymous.exportGeoJson('admin_boundaries', [NORTH.minX, NORTH.minY, NORTH.maxX, NORTH.maxY]).catch(ignore);
  } else {
    const lon = between(random, 2.0, 5.5);
    const lat = between(random, -44.0, -40.5);
    await anonymous.exportGeoJson('parcels', [lon, lat, lon + 0.5, lat + 0.5]).catch(ignore);
  }
}

function partner(key: string) {
  return async () => {
    const random = iterationRandom();
    const lon = between(random, EXTENT.minX, EXTENT.maxX - 0.05);
    const lat = between(random, EXTENT.minY, EXTENT.maxY - 0.05);
    const client = new CityMapClient({ baseUrl: API, transport, apiKey: key });
    await client.partnerFeatures(pick(random, ['parcels', 'announcements']), [lon, lat, lon + 0.05, lat + 0.05]).catch(ignore);
  };
}

export const partner_transit = partner(PARTNER_KEYS.transit);
export const partner_pitlane = partner(PARTNER_KEYS.pitlane);

export function handleSummary(data: Parameters<typeof writeSummary>[0]) {
  return writeSummary(data, SCENARIO === 'peak' ? `peak-x${MULTIPLIER}` : SCENARIO);
}
