import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import configuration, { AppConfig } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { SupabaseModule } from './infrastructure/supabase/supabase.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AuthModule } from './modules/auth/auth.module';
import { BloodGroupsModule } from './modules/blood-groups/blood-groups.module';
import { BranchesModule } from './modules/branches/branches.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { DesignationsModule } from './modules/designations/designations.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { HealthModule } from './modules/health/health.module';
import { HolidaysModule } from './modules/holidays/holidays.module';
import { LeaveTypesModule } from './modules/leave-types/leave-types.module';
import { LeavesModule } from './modules/leaves/leaves.module';
import { UsersModule } from './modules/users/users.module';
import { WorkShiftsModule } from './modules/work-shifts/work-shifts.module';

@Module({
  imports: [
    // ── configuration & cross-cutting infrastructure ──
    ConfigModule.forRoot({ isGlobal: true, cache: true, load: [configuration], validate: validateEnv }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const env = config.get('nodeEnv', { infer: true });
        const isProd = env === 'production';
        return {
          pinoHttp: {
            level: env === 'test' ? 'silent' : isProd ? 'info' : 'debug',
            transport: isProd ? undefined : { target: 'pino-pretty', options: { singleLine: true } },
            redact: ['req.headers.authorization', 'req.headers.token', 'req.headers.cookie'],
            autoLogging: { ignore: (req) => req.url?.includes('/health') ?? false },
          },
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const t = config.get('throttle', { infer: true });
        return { throttlers: [{ ttl: t.ttlSeconds * 1000, limit: t.limit }] };
      },
    }),
    PrismaModule,
    SupabaseModule,

    // ── feature modules ──
    AuthModule,
    UsersModule,
    EmployeesModule,
    DepartmentsModule,
    DesignationsModule,
    BranchesModule,
    WorkShiftsModule,
    BloodGroupsModule,
    LeaveTypesModule,
    HolidaysModule,
    LeavesModule,
    AttendanceModule,
    DashboardModule,
    HealthModule,
  ],
  providers: [
    // Guard order matters: throttle -> authenticate -> authorise
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {}
