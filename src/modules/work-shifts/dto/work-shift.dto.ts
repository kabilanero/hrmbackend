import { ApiProperty, ApiPropertyOptional, IntersectionType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { BaseEntityDto } from '../../../common/dto/base-entity.dto';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateWorkShiftDto {
  @ApiProperty({ example: 'General Shift' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: '09:00', description: '24h HH:mm' })
  @Matches(HHMM, { message: 'startTime must be HH:mm (24h)' })
  startTime!: string;

  @ApiProperty({ example: '18:00', description: '24h HH:mm' })
  @Matches(HHMM, { message: 'endTime must be HH:mm (24h)' })
  endTime!: string;

  @ApiProperty({ example: 540, description: 'Shift duration in minutes' })
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMin!: number;

  @ApiPropertyOptional({ example: 10, description: 'Late-arrival grace in minutes' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  graceMin?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
export class UpdateWorkShiftDto extends PartialType(CreateWorkShiftDto) {}
export class WorkShiftDto extends IntersectionType(BaseEntityDto, CreateWorkShiftDto) {}
