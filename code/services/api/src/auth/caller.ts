import { createParamDecorator, ExecutionContext, Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { verifyToken } from './token';

/** Authenticated username, or null for anonymous callers. */
export type Caller = string | null;

type RequestWithCaller = Request & { caller?: Caller };

@Injectable()
export class CallerMiddleware implements NestMiddleware {
  use(req: RequestWithCaller, _res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header) {
      req.caller = null;
      return next();
    }
    const [scheme, token] = header.split(' ');
    const username = scheme === 'Bearer' && token ? verifyToken(token, config.jwtSecret) : undefined;
    if (!username) throw new UnauthorizedException('invalid token');
    req.caller = username;
    next();
  }
}

export const CurrentCaller = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Caller => ctx.switchToHttp().getRequest<RequestWithCaller>().caller ?? null,
);
