import http from 'node:http';
import https from 'node:https';
import type { Transport, TransportRequest, TransportResponse } from '../client';

// Partner gateways admit 4 concurrent connections per client and close idle ones after 5 s.
const agentOptions = { keepAlive: true, keepAliveMsecs: 4_000, maxSockets: 4, maxFreeSockets: 4, timeout: 4_500 };
const httpAgent = new http.Agent(agentOptions);
const httpsAgent = new https.Agent(agentOptions);

export const nodeTransport: Transport = {
  request(req: TransportRequest): Promise<TransportResponse> {
    const url = new URL(req.url);
    const lib = url.protocol === 'https:' ? https : http;
    return new Promise((resolve, reject) => {
      const outgoing = lib.request(
        url,
        { method: req.method, headers: req.headers, agent: url.protocol === 'https:' ? httpsAgent : httpAgent },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
          res.on('error', reject);
        },
      );
      outgoing.setTimeout(req.timeoutMs, () => outgoing.destroy(new Error(`timeout after ${req.timeoutMs} ms`)));
      outgoing.on('error', reject);
      if (req.body !== undefined) outgoing.write(req.body);
      outgoing.end();
    });
  },
};
