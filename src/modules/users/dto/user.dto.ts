import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { RoleName } from '../../../common/constants/roles.constant';

export class CreateUserDto {
  @ApiProperty() @IsEmail() email!: string;

  @ApiProperty({ example: 'Str0ngPassw0rd' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/, {
    message: 'password must be 8-72 chars and include upper-case, lower-case and a digit',
  })
  password!: string;

  @ApiProperty({ enum: RoleName, default: RoleName.EMPLOYEE })
  @IsEnum(RoleName)
  role!: RoleName;

  @ApiPropertyOptional({ format: 'uuid', description: 'Employee this login belongs to' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ enum: RoleName }) @IsOptional() @IsEnum(RoleName) role?: RoleName;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() employeeId?: string;
}

export class UserDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: RoleName }) role!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) employeeId!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ nullable: true }) lastLoginAt!: Date | null;
  @ApiProperty() createdAt!: Date;
}
