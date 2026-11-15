import { parseBbox, parseCoordinate, parseLayerList } from './geo';

describe('parseBbox', () => {
  it('parses a valid bbox', () => {
    expect(parseBbox('2.1,-42.5,2.3,-42.1')).toEqual([2.1, -42.5, 2.3, -42.1]);
  });

  it.each(['', '1,2,3', 'a,b,c,d', '3,0,1,1', '0,0,190,1'])('rejects "%s"', (raw) => {
    expect(parseBbox(raw)).toBeUndefined();
  });
});

describe('parseCoordinate', () => {
  it('accepts values within range', () => {
    expect(parseCoordinate('-40.25', 90)).toBe(-40.25);
  });

  it('rejects out of range and junk', () => {
    expect(parseCoordinate('91', 90)).toBeUndefined();
    expect(parseCoordinate('north', 90)).toBeUndefined();
  });
});

describe('parseLayerList', () => {
  it('normalises order and duplicates', () => {
    expect(parseLayerList('parcels, addresses,parcels', [])).toEqual(['addresses', 'parcels']);
  });

  it('falls back to defaults', () => {
    expect(parseLayerList(undefined, ['b', 'a'])).toEqual(['a', 'b']);
  });
});
