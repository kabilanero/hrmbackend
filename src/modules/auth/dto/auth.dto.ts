import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;
const PASSWORD_MSG = 'password must be 8-72 chars and include upper-case, lower-case and a digit';

export class LoginDto {
  @ApiProperty({ example: 'admin@company.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Str0ngPassw0rd' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'jane.doe@company.com', description: 'Must match an existing employee emailId to link the profile' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Str0ngPassw0rd' })
  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG })
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty()
  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG })
  @MaxLength(72)
  newPassword!: string;
}

export class AuthUserDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ example: 'ADMIN' }) role!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) employeeId!: string | null;
}

export class AuthSessionDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ example: 'Bearer' }) tokenType!: string;
  @ApiProperty({ description: 'Seconds until the access token expires' }) expiresIn!: number;
  @ApiProperty({ type: AuthUserDto }) user!: AuthUserDto;
}
