import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma client running on the `pg` driver adapter (Rust-free engine).
 * DATABASE_URL should be the Supabase *pooled* connection string (port 6543).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: PrismaService.cleanConnectionString(process.env.DATABASE_URL as string),
        max: Number(process.env.DB_POOL_MAX ?? 10),
      }),
      log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
      errorFormat: 'minimal',
    });
  }

  /** Drops Prisma-specific URL params (pgbouncer, connection_limit…) that the pg driver does not understand. */
  private static cleanConnectionString(raw: string): string {
    try {
      const url = new URL(raw);
      ['pgbouncer', 'connection_limit', 'pool_timeout', 'schema'].forEach((p) => url.searchParams.delete(p));
      return url.toString();
    } catch {
      return raw;
    }
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL (Supabase)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

