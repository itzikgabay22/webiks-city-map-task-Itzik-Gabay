import http from 'k6/http';
import type { Transport, TransportRequest, TransportResponse } from '../client';

/** Transport for k6 load tests. Requests are tagged with the logical endpoint name. */
export const k6Transport: Transport = {
  async request(req: TransportRequest): Promise<TransportResponse> {
    const res = await http.asyncRequest(req.method, req.url, req.body ?? null, {
      headers: req.headers,
      timeout: `${req.timeoutMs}ms`,
      tags: { endpoint: req.endpoint, name: req.endpoint },
    });
    if (res.status === 0) throw new Error(res.error || 'request failed');
    return { status: res.status, body: typeof res.body === 'string' ? res.body : '' };
  },
};
