/** Race-weekend dataset for the Velorian Grand Prix, generated from survey parameters. */

export interface AnnouncementFeature {
  kind: 'road_closure' | 'detour' | 'spectator_zone' | 'shuttle_stop';
  title: string;
  properties: Record<string, unknown>;
  /** GeoJSON geometry, EPSG:4326. */
  geometry: { type: string; coordinates: unknown };
}

// Circuit centre (Portavel street circuit) and approximate radius in degrees.
const CENTRE: [number, number] = [4.1, -42.1];
const RADIUS = 0.035;

function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

function onRing(angle: number, r: number): [number, number] {
  return [round(CENTRE[0] + r * Math.cos(angle)), round(CENTRE[1] + r * 0.75 * Math.sin(angle))];
}

export function buildRaceWeekendDataset(weekendStart: string, seed = 2026): AnnouncementFeature[] {
  const random = prng(seed);
  const day = (offset: number, hour: number) => {
    const d = new Date(`${weekendStart}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + offset);
    d.setUTCHours(hour);
    return d.toISOString();
  };
  const features: AnnouncementFeature[] = [];

  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * 2 * Math.PI;
    const r = RADIUS * (1 + 0.3 * random());
    features.push({
      kind: 'road_closure',
      title: `Closure ${String(i + 1).padStart(3, '0')}`,
      properties: { closedFrom: day(0, 6), reopensAt: day(2, 23), access: random() < 0.2 ? 'residents' : 'none' },
      geometry: { type: 'LineString', coordinates: [onRing(a, r), onRing(a + 0.05, r)] },
    });
  }

  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * 2 * Math.PI;
    features.push({
      kind: 'detour',
      title: `Detour ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) + 1}`,
      properties: { validFrom: day(0, 6), validUntil: day(2, 23) },
      geometry: {
        type: 'LineString',
        coordinates: [onRing(a, RADIUS * 1.6), onRing(a + 0.08, RADIUS * 1.9), onRing(a + 0.16, RADIUS * 1.6)],
      },
    });
  }

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * 2 * Math.PI;
    const ring = [0, 1, 2, 3].map((k) => onRing(a + k * 0.04, RADIUS * (1.15 + (k % 2) * 0.1)));
    features.push({
      kind: 'spectator_zone',
      title: `Grandstand ${i + 1}`,
      properties: { capacity: 2000 + Math.floor(random() * 8000), opens: day(1, 7) },
      geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] },
    });
  }

  for (let i = 0; i < 60; i++) {
    features.push({
      kind: 'shuttle_stop',
      title: `Shuttle stop ${i + 1}`,
      properties: { line: `S${1 + (i % 6)}`, firstDeparture: day(0, 5) },
      geometry: { type: 'Point', coordinates: onRing(random() * 2 * Math.PI, RADIUS * (2 + random())) },
    });
  }

  return features;
}
