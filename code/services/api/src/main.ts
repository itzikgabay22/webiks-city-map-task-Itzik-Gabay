import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { rateLimit } from 'express-rate-limit';
import Redis from 'ioredis';
import { RedisReply, RedisStore } from 'rate-limit-redis';
import { AppModule } from './app.module';
import { RequestLoggingInterceptor } from './common/request-logging.interceptor';
import { config } from './config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['log', 'warn', 'error'] });

  // Public data must be embeddable by any site (see docs/ARCHITECTURE.md).
  app.enableCors({ origin: '*', methods: ['GET', 'POST'], maxAge: 600 });

  // Partner API quota, shared by all API replicas through Redis.
  const limiterRedis = new Redis(config.redisUrl, { maxRetriesPerRequest: 2 });
  app.use(
    '/partner',
    rateLimit({
      windowMs: 60_000,
      limit: config.partnerRequestsPerMinute,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      store: new RedisStore({
        prefix: 'ratelimit:partner:',
        sendCommand: (command: string, ...args: string[]) => limiterRedis.call(command, ...args) as Promise<RedisReply>,
      }),
    }),
  );

  app.useGlobalInterceptors(new RequestLoggingInterceptor());
  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');
}

void bootstrap();
