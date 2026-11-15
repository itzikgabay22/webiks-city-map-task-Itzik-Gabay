import jwt from 'jsonwebtoken';

const ISSUER = 'citymap';

export function issueToken(username: string, secret: string, ttlSeconds = 8 * 3600): string {
  return jwt.sign({ sub: username }, secret, { issuer: ISSUER, expiresIn: ttlSeconds, algorithm: 'HS256' });
}

/** Returns the username for a valid token, or undefined. */
export function verifyToken(token: string, secret: string): string | undefined {
  try {
    const payload = jwt.verify(token, secret, { issuer: ISSUER, algorithms: ['HS256'] });
    return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : undefined;
  } catch {
    return undefined;
  }
}
