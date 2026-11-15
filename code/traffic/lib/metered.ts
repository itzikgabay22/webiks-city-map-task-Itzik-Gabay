import { Counter, Trend } from 'k6/metrics';
import type { Transport } from '../../services/sdk/src/client.ts';

export const ENDPOINTS = [
  'login', 'layers', 'summary', 'features_at', 'geojson', 'search', 'partner_features', 'announcements', 'tiles',
] as const;

// k6 requires metrics to be declared in the init context.
const latency: Record<string, Trend> = Object.fromEntries(
  ENDPOINTS.map((e) => [e, new Trend(`latency_${e}`, true)]),
);
const attempts = new Counter('sdk_attempts');
const failures = new Counter('sdk_failed_attempts');

export function recordLatency(endpoint: string, ms: number): void {
  latency[endpoint]?.add(ms);
}

/** Wraps a transport to record per-endpoint latency for every attempt, including retries. */
export function metered(inner: Transport): Transport {
  return {
    async request(req) {
      const started = Date.now();
      attempts.add(1, { endpoint: req.endpoint });
      try {
        const res = await inner.request(req);
        if (res.status >= 400) failures.add(1, { endpoint: req.endpoint, status: String(res.status) });
        return res;
      } catch (err) {
        failures.add(1, { endpoint: req.endpoint, status: '0' });
        throw err;
      } finally {
        recordLatency(req.endpoint, Date.now() - started);
      }
    },
  };
}
