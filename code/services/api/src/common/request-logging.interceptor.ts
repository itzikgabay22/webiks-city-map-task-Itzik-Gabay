import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

/** One structured line per request, for the log pipeline. */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = ctx.switchToHttp();
    const req = http.getRequest<Request>();
    const started = process.hrtime.bigint();

    const write = (status: number) =>
      process.stdout.write(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: status >= 500 ? 'error' : 'info',
          msg: 'request',
          method: req.method,
          url: req.originalUrl,
          status,
          durationMs: Number(process.hrtime.bigint() - started) / 1e6,
        }) + '\n',
      );

    return next.handle().pipe(
      tap({
        next: () => write(http.getResponse<Response>().statusCode),
        error: (err) => write(err instanceof HttpException ? err.getStatus() : 500),
      }),
    );
  }
}
