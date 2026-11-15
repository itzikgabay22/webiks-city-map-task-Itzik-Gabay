import jwt from 'jsonwebtoken';
import { issueToken, verifyToken } from './token';

describe('tokens', () => {
  const secret = 'unit-test-secret';

  it('round-trips the username', () => {
    expect(verifyToken(issueToken('alice', secret), secret)).toBe('alice');
  });

  it('rejects a token signed with another secret', () => {
    expect(verifyToken(issueToken('alice', 'other'), secret)).toBeUndefined();
  });

  it('rejects an expired token', () => {
    const token = jwt.sign({ sub: 'alice', exp: Math.floor(Date.now() / 1000) - 10 }, secret, { issuer: 'citymap' });
    expect(verifyToken(token, secret)).toBeUndefined();
  });

  it('rejects unsigned tokens', () => {
    const token = jwt.sign({ sub: 'alice' }, '', { algorithm: 'none', issuer: 'citymap' } as jwt.SignOptions);
    expect(verifyToken(token, secret)).toBeUndefined();
  });
});
