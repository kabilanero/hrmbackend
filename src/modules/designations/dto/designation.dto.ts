import { ApiProperty, ApiPropertyOptional, IntersectionType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { BaseEntityDto } from '../../../common/dto/base-entity.dto';

export class CreateDesignationDto {
  @ApiProperty({ example: 'Senior Software Engineer' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Seniority level (higher = more senior)', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  level?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
export class UpdateDesignationDto extends PartialType(CreateDesignationDto) {}
export class DesignationDto extends IntersectionType(BaseEntityDto, CreateDesignationDto) {}
