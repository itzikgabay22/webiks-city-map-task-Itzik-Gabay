/**
 * CityMap client SDK. Runtime-agnostic: the HTTP layer is supplied as a
 * Transport (see ./transports/node.ts for Node.js and ./transports/k6.ts
 * for k6), so the same request policy is used everywhere.
 *
 * This file must not import any runtime-specific module.
 */

export interface TransportRequest {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
  /** Logical endpoint name, for transports that tag metrics. */
  endpoint: string;
}

export interface TransportResponse {
  status: number;
  body: string;
}

export interface Transport {
  /** Resolves for any HTTP status; rejects only on network errors or timeouts. */
  request(req: TransportRequest): Promise<TransportResponse>;
}

export interface ClientOptions {
  baseUrl: string;
  transport: Transport;
  apiKey?: string;
  token?: string;
  timeoutMs?: number;
  retries?: number;
}

export class CityMapError extends Error {
  constructor(message: string, readonly status: number, readonly attempts: number) {
    super(message);
  }
}

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

/** Query string builder (URLSearchParams is not available in every runtime). */
function qs(params: Record<string, string | number | undefined>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

export class CityMapClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly retries: number;

  constructor(private readonly options: ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.retries = options.retries ?? 3;
  }

  withToken(token: string): CityMapClient {
    return new CityMapClient({ ...this.options, token });
  }

  async login(username: string): Promise<CityMapClient> {
    const res = await this.send<{ token: string }>('POST', '/auth/dev-login', 'login', JSON.stringify({ username }));
    return this.withToken(res.token);
  }

  layers() {
    return this.send<unknown[]>('GET', '/layers', 'layers');
  }

  layerSummary(layerId: string) {
    return this.send('GET', `/layers/${encodeURIComponent(layerId)}/summary`, 'summary');
  }

  featuresAt(lon: number, lat: number, layers?: string[]) {
    const query = qs({ lon, lat, layers: layers?.length ? layers.join(',') : undefined });
    return this.send('GET', `/features/at?${query}`, 'features_at');
  }

  exportGeoJson(layerId: string, bbox: [number, number, number, number], simplify?: number) {
    const query = qs({ bbox: bbox.join(','), simplify });
    return this.send('GET', `/layers/${encodeURIComponent(layerId)}/geojson?${query}`, 'geojson');
  }

  searchAddress(q: string) {
    return this.send('GET', `/search/address?${qs({ q })}`, 'search');
  }

  partnerFeatures(layer: string, bbox: [number, number, number, number]) {
    const query = qs({ layer, bbox: bbox.join(',') });
    return this.send('GET', `/partner/v1/features?${query}`, 'partner_features');
  }

  latestAnnouncement() {
    return this.send('GET', '/announcements/latest', 'announcements');
  }

  private async send<T = unknown>(method: 'GET' | 'POST', path: string, endpoint: string, body?: string): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (this.options.token) headers.authorization = `Bearer ${this.options.token}`;
    if (this.options.apiKey) headers['x-api-key'] = this.options.apiKey;

    let lastError = 'no attempt made';
    let lastStatus = 0;
    for (let attempt = 1; attempt <= this.retries + 1; attempt++) {
      try {
        const res = await this.options.transport.request({
          method, url: this.baseUrl + path, headers, body, timeoutMs: this.timeoutMs, endpoint,
        });
        if (res.status >= 200 && res.status < 300) return JSON.parse(res.body) as T;
        lastStatus = res.status;
        lastError = `HTTP ${res.status}`;
        if (!RETRYABLE_STATUS.has(res.status)) break;
      } catch (err) {
        lastStatus = 0;
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
    throw new CityMapError(`${method} ${path} failed: ${lastError}`, lastStatus, this.retries + 1);
  }
}
