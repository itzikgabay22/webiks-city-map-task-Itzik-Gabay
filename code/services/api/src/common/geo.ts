export type BBox = [number, number, number, number];

export function parseBbox(raw: string | undefined): BBox | undefined {
  if (!raw) return undefined;
  const parts = raw.split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return undefined;
  const [minX, minY, maxX, maxY] = parts;
  if (minX >= maxX || minY >= maxY) return undefined;
  if (minX < -180 || maxX > 180 || minY < -90 || maxY > 90) return undefined;
  return [minX, minY, maxX, maxY];
}

export function parseCoordinate(raw: string | undefined, limit: number): number | undefined {
  if (raw === undefined || raw === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && Math.abs(value) <= limit ? value : undefined;
}

export function parseLayerList(raw: string | undefined, fallback: string[]): string[] {
  const list = (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return [...new Set(list.length ? list : fallback)].sort();
}
