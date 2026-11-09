import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, HealthIndicatorService, MemoryHealthIndicator } from '@nestjs/terminus';
import { Public } from '../../common/decorators/public.decorator';
import { RawResponse } from '../../common/decorators/raw-response.decorator';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('Health')
@Public()
@SkipThrottle()
@RawResponse()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicator: HealthIndicatorService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  @HealthCheck()
  live() {
    return this.health.check([() => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024)]);
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (database reachable)' })
  @HealthCheck()
  ready() {
    return this.health.check([
      async () => {
        const check = this.indicator.check('database');
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return check.up();
        } catch {
          return check.down({ message: 'database unreachable' });
        }
      },
    ]);
  }
}
