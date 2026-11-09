import { ApiProperty, ApiPropertyOptional, IntersectionType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { BaseEntityDto } from '../../../common/dto/base-entity.dto';

export class CreateBranchDto {
  @ApiProperty({ example: 'BLR-01' })
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  code!: string;

  @ApiProperty({ example: 'Bengaluru HQ' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[+0-9\-\s()]{6,20}$/, { message: 'phone must be a valid phone number' })
  phone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) addressLine?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) pincode?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
export class UpdateBranchDto extends PartialType(CreateBranchDto) {}
export class BranchDto extends IntersectionType(BaseEntityDto, CreateBranchDto) {}
