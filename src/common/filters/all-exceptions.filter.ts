import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

interface ErrorBody {
  success: false;
  statusCode: number;
  error: string;
  message: string;
  errors?: string[];
  path: string;
  timestamp: string;
}

/**
 * Single place that turns every thrown error (HTTP, Prisma, unknown) into one
 * consistent JSON error contract. Internal details are never leaked on 5xx.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const { status, message, errors } = this.normalize(exception);

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorBody = {
      success: false,
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      message,
      ...(errors ? { errors } : {}),
      path: req.url,
      timestamp: new Date().toISOString(),
    };
    res.status(status).json(body);
  }

  private normalize(exception: unknown): { status: number; message: string; errors?: string[] } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') return { status, message: payload };
      const p = payload as { message?: string | string[] };
      if (Array.isArray(p.message)) {
        return { status, message: 'Validation failed', errors: p.message };
      }
      return { status, message: p.message ?? exception.message };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          const fields = this.constraintFields(exception) ?? 'field';
          return { status: HttpStatus.CONFLICT, message: `A record with the same ${fields} already exists` };
        }
        case 'P2025':
          return { status: HttpStatus.NOT_FOUND, message: 'Record not found' };
        case 'P2003': {
          // Postgres wording: "insert or update on table … violates foreign key" (bad reference)
          // vs "update or delete on table … violates foreign key" (record still in use)
          const original = this.driverMessage(exception) ?? '';
          return /^insert or update/i.test(original)
            ? { status: HttpStatus.BAD_REQUEST, message: 'A referenced record (e.g. department, branch, manager) does not exist' }
            : { status: HttpStatus.CONFLICT, message: 'The record is still referenced by other records and cannot be changed or deleted' };
        }
        case 'P2000':
          return { status: HttpStatus.BAD_REQUEST, message: 'A provided value is too long for its column' };
        default:
          return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Database error' };
      }
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return { status: HttpStatus.BAD_REQUEST, message: 'Invalid query parameters' };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }

  /** Constraint column names, for both the classic engine (meta.target) and driver adapters. */
  private constraintFields(e: Prisma.PrismaClientKnownRequestError): string | undefined {
    const meta = e.meta as any;
    const fields: unknown = meta?.target ?? meta?.driverAdapterError?.cause?.constraint?.fields;
    if (Array.isArray(fields)) return fields.join(', ');
    return typeof fields === 'string' ? fields : undefined;
  }

  private driverMessage(e: Prisma.PrismaClientKnownRequestError): string | undefined {
    return (e.meta as any)?.driverAdapterError?.cause?.originalMessage;
  }
}
