import { buildRaceWeekendDataset } from './dataset';

describe('buildRaceWeekendDataset', () => {
  const features = buildRaceWeekendDataset('2026-10-30');

  it('is deterministic', () => {
    expect(buildRaceWeekendDataset('2026-10-30')).toEqual(features);
  });

  it('contains every announcement kind', () => {
    const kinds = new Set(features.map((f) => f.kind));
    expect([...kinds].sort()).toEqual(['detour', 'road_closure', 'shuttle_stop', 'spectator_zone']);
  });

  it('closes every polygon ring', () => {
    for (const f of features.filter((x) => x.geometry.type === 'Polygon')) {
      const ring = (f.geometry.coordinates as number[][][])[0];
      expect(ring[0]).toEqual(ring[ring.length - 1]);
    }
  });

  it('dates closures within the race weekend', () => {
    const closure = features.find((f) => f.kind === 'road_closure')!;
    expect(closure.properties.closedFrom).toBe('2026-10-30T06:00:00.000Z');
    expect(closure.properties.reopensAt).toBe('2026-11-01T23:00:00.000Z');
  });
});
