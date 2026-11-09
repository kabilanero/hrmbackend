import { ApiProperty, ApiPropertyOptional, IntersectionType, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { BaseEntityDto } from '../../../common/dto/base-entity.dto';

export class CreateHolidayDto {
  @ApiProperty({ example: 'Republic Day' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: '2026-01-26', description: 'ISO date (YYYY-MM-DD)' })
  @IsDateString({ strict: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.slice(0, 10) : value))
  date!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
export class UpdateHolidayDto extends PartialType(CreateHolidayDto) {}
export class HolidayDto extends IntersectionType(BaseEntityDto, OmitType(CreateHolidayDto, ['date'] as const)) {
  @ApiProperty({ example: '2026-01-26T00:00:00.000Z' }) date!: Date;
  @ApiProperty({ example: 2026 }) year!: number;
}
