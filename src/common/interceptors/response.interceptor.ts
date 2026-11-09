import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable, map } from 'rxjs';
import { RAW_RESPONSE_KEY } from '../decorators/raw-response.decorator';
import { Paginated } from '../utils/paginated';

/**
 * Wraps every successful response in a uniform envelope:
 *   { success, statusCode, data, meta?, path, timestamp }
 * `Paginated` results are flattened into `data` (items) + `meta` (page info).
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const raw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (raw) return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse();

    return next.handle().pipe(
      map((result) => {
        const base = {
          success: true,
          statusCode: res.statusCode,
          path: req.url,
          timestamp: new Date().toISOString(),
        };
        if (result instanceof Paginated) {
          return { ...base, data: result.items, meta: result.meta };
        }
        return { ...base, data: result ?? null };
      }),
    );
  }
}
