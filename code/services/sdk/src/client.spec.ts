import { CityMapClient, CityMapError, Transport, TransportRequest } from './client';

function scripted(responses: Array<number | Error>): Transport & { calls: TransportRequest[] } {
  const calls: TransportRequest[] = [];
  return {
    calls,
    async request(req) {
      calls.push(req);
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return { status: next ?? 500, body: '{"ok":true}' };
    },
  };
}

describe('CityMapClient', () => {
  it('returns the parsed body on success', async () => {
    const transport = scripted([200]);
    const client = new CityMapClient({ baseUrl: 'http://api/', transport });
    await expect(client.layers()).resolves.toEqual({ ok: true });
    expect(transport.calls[0].url).toBe('http://api/layers');
  });

  it('retries transient failures and then succeeds', async () => {
    const transport = scripted([503, new Error('socket hang up'), 200]);
    const client = new CityMapClient({ baseUrl: 'http://api', transport });
    await expect(client.layerSummary('parcels')).resolves.toEqual({ ok: true });
    expect(transport.calls).toHaveLength(3);
  });

  it('does not retry client errors', async () => {
    const transport = scripted([404]);
    const client = new CityMapClient({ baseUrl: 'http://api', transport });
    await expect(client.layerSummary('nope')).rejects.toBeInstanceOf(CityMapError);
    expect(transport.calls).toHaveLength(1);
  });

  it('gives up after the configured retries', async () => {
    const transport = scripted([503, 503, 503, 503, 503]);
    const client = new CityMapClient({ baseUrl: 'http://api', transport, retries: 3 });
    await expect(client.layers()).rejects.toMatchObject({ status: 503, attempts: 4 });
    expect(transport.calls).toHaveLength(4);
  });

  it('sends the API key and bearer token', async () => {
    const transport = scripted([200]);
    const client = new CityMapClient({ baseUrl: 'http://api', transport, apiKey: 'k' }).withToken('t');
    await client.partnerFeatures('parcels', [1, 2, 3, 4]);
    expect(transport.calls[0].headers).toMatchObject({ 'x-api-key': 'k', authorization: 'Bearer t' });
  });
});
