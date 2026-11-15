import { likePrefix } from './sql';

describe('likePrefix', () => {
  it('matches values starting with the query', () => {
    expect(likePrefix('olive street 12')).toBe('olive street 12%');
  });

  it('escapes LIKE wildcards and backslashes in user input', () => {
    expect(likePrefix('100%_off\\')).toBe('100\\%\\_off\\\\%');
  });
});
