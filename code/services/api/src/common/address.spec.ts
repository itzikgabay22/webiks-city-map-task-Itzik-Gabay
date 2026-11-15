import { parseAddressQuery } from './address';

describe('parseAddressQuery', () => {
  it('splits street and trailing number', () => {
    expect(parseAddressQuery('Olive Street 12')).toEqual({ street: 'olive street', houseNumber: 12 });
  });

  it('accepts a leading number', () => {
    expect(parseAddressQuery('  12   olive street ')).toEqual({ street: 'olive street', houseNumber: 12 });
  });

  it('works without a number', () => {
    expect(parseAddressQuery('Harbour Lane')).toEqual({ street: 'harbour lane', houseNumber: null });
  });
});
