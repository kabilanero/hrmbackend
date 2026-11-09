import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, description: '1-based page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100, description: 'Page size' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size: number = 20;

  @ApiPropertyOptional({ example: 'createdAt:desc', description: 'field:asc|desc' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z_][A-Za-z0-9_.]*(:(asc|desc))?$/, { message: 'sort must look like field:asc|desc' })
  sort?: string;

  @ApiPropertyOptional({ description: 'Free-text search across the resource searchable fields' })
  @IsOptional()
  @IsString()
  search?: string;
}
