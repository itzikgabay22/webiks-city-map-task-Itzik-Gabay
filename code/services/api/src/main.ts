import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import Redis from 'ioredis';
import { RedisReply, RedisStore } from 'rate-limit-redis';
import { AppModule } from './app.module';
import { RequestLoggingInterceptor } from './common/request-logging.interceptor';
import { config } from './config';
import { metricsHandler, metricsMiddleware } from './metrics';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['log', 'warn', 'error'] });

  // Public data must be embeddable by any site (see docs/ARCHITECTURE.md).
  app.enableCors({ origin: '*', methods: ['GET', 'POST'], maxAge: 600 });

  app.use(metricsMiddleware);
  app.use('/metrics', (req: Request, res: Response, next: NextFunction) => {
    void metricsHandler(req, res).catch(next);
  });

  // Partner API quota: one bucket per API key (not per ingress IP), shared across replicas.
  // maxRetriesPerRequest=null avoids MaxRetriesPerRequestError turning partner traffic into HTTP 500.
  const limiterRedis = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });
  limiterRedis.on('error', (err) => {
    // Keep the process up; passOnStoreError lets traffic through if Redis blips.
    console.warn(`partner rate-limit redis: ${err.message}`);
  });

  app.use(
    '/partner',
    rateLimit({
      windowMs: 60_000,
      limit: config.partnerRequestsPerMinute,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      passOnStoreError: true,
      keyGenerator: (req) => {
        const apiKey = req.header('x-api-key');
        if (apiKey) return `key:${createHash('sha256').update(apiKey).digest('hex')}`;
        return `ip:${req.ip ?? 'unknown'}`;
      },
      store: new RedisStore({
        prefix: 'ratelimit:partner:',
        sendCommand: (command: string, ...args: string[]) =>
          limiterRedis.call(command, ...args) as Promise<RedisReply>,
      }),
    }),
  );

  app.useGlobalInterceptors(new RequestLoggingInterceptor());
  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');
}

void bootstrap();
