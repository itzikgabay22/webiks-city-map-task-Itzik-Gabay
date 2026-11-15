import type { NextFunction, Request, Response } from 'express';
import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequests = new client.Counter({
  name: 'citymap_http_requests_total',
  help: 'CityMap API HTTP requests',
  labelNames: ['method', 'route', 'status_class'],
  registers: [register],
});

const httpDuration = new client.Histogram({
  name: 'citymap_http_request_duration_seconds',
  help: 'CityMap API HTTP request duration',
  labelNames: ['method', 'route', 'status_class'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

function routeLabel(url: string): string {
  const path = url.split('?')[0] || '/';
  if (path === '/health' || path === '/metrics') return path;
  if (path.startsWith('/partner/')) return '/partner/*';
  if (path.startsWith('/features/')) return '/features/*';
  if (path.startsWith('/layers/') && path.endsWith('/summary')) return '/layers/:id/summary';
  if (path.startsWith('/layers/') && path.includes('/geojson')) return '/layers/:id/geojson';
  if (path.startsWith('/layers')) return '/layers';
  if (path.startsWith('/search/')) return '/search/*';
  if (path.startsWith('/announcements')) return '/announcements/*';
  if (path.startsWith('/auth/')) return '/auth/*';
  return 'other';
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/metrics') {
    next();
    return;
  }
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    const labels = {
      method: req.method,
      route: routeLabel(req.originalUrl || req.url),
      status_class: `${Math.floor(res.statusCode / 100)}xx`,
    };
    httpRequests.inc(labels);
    end(labels);
  });
  next();
}

export async function metricsHandler(_req: Request, res: Response): Promise<void> {
  res.setHeader('Content-Type', register.contentType);
  res.end(await register.metrics());
}
