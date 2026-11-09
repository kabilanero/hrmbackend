import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const dateOnly = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.slice(0, 10) : value);

export class ApplyLeaveDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() leaveTypeId!: string;

  @ApiProperty({ example: '2026-12-24' })
  @Transform(dateOnly)
  @IsDateString({ strict: true })
  startDate!: string;

  @ApiProperty({ example: '2026-12-26' })
  @Transform(dateOnly)
  @IsDateString({ strict: true })
  endDate!: string;

  @ApiProperty({ example: 'Family function' }) @IsString() @MinLength(3) @MaxLength(500) reason!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'HR/Admin only: apply on behalf of this employee' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}

export class LeaveDecisionDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) remarks?: string;
}

export class LeaveQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: LeaveStatus }) @IsOptional() @IsEnum(LeaveStatus) status?: LeaveStatus;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() employeeId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() leaveTypeId?: string;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'Leaves ending on/after this date' })
  @IsOptional()
  @Transform(dateOnly)
  @IsDateString({ strict: true })
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Leaves starting on/before this date' })
  @IsOptional()
  @Transform(dateOnly)
  @IsDateString({ strict: true })
  to?: string;
}

export class LeaveBalanceQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Defaults to the signed-in employee' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}
