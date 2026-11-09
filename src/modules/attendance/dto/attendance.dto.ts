import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const dateOnly = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.slice(0, 10) : value);

export class UpsertAttendanceDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() employeeId!: string;

  @ApiProperty({ example: '2026-11-06' })
  @Transform(dateOnly)
  @IsDateString({ strict: true })
  date!: string;

  @ApiPropertyOptional({ example: '2026-11-06T09:02:00+05:30' }) @IsOptional() @IsISO8601() punchIn?: string;
  @ApiPropertyOptional({ example: '2026-11-06T18:10:00+05:30' }) @IsOptional() @IsISO8601() punchOut?: string;
  @ApiPropertyOptional({ enum: AttendanceStatus }) @IsOptional() @IsEnum(AttendanceStatus) status?: AttendanceStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) remarks?: string;
}

export class AttendanceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() employeeId?: string;
  @ApiPropertyOptional({ enum: AttendanceStatus }) @IsOptional() @IsEnum(AttendanceStatus) status?: AttendanceStatus;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @Transform(dateOnly)
  @IsDateString({ strict: true })
  from?: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @Transform(dateOnly)
  @IsDateString({ strict: true })
  to?: string;
}

export class MonthlyAttendanceQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Defaults to the signed-in employee' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiProperty({ example: 2026 }) @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year!: number;
  @ApiProperty({ example: 11 }) @Type(() => Number) @IsInt() @Min(1) @Max(12) month!: number;
}
