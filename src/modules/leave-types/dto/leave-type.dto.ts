import { ApiProperty, ApiPropertyOptional, IntersectionType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { BaseEntityDto } from '../../../common/dto/base-entity.dto';

export class CreateLeaveTypeDto {
  @ApiProperty({ example: 'CL' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code!: string;

  @ApiProperty({ example: 'Casual Leave' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 12, description: 'Annual entitlement in days (0 = unlimited)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(366)
  maxDaysYear?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
export class UpdateLeaveTypeDto extends PartialType(CreateLeaveTypeDto) {}
export class LeaveTypeDto extends IntersectionType(BaseEntityDto, CreateLeaveTypeDto) {}
