import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Gender, MaritalStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const PHONE = /^[+0-9\-\s()]{6,20}$/;
const toBool = ({ value }: { value: unknown }) =>
  value === 'true' || value === true ? true : value === 'false' || value === false ? false : value;
const dateOnly = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.slice(0, 10) : value);

export class CreateEmployeeDto {
  @ApiProperty({ example: 'EMP-0001' }) @IsString() @MinLength(1) @MaxLength(30) employeeCode!: string;
  @ApiProperty({ example: 'Jane Doe' }) @IsString() @MinLength(2) @MaxLength(150) employeeName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) fatherName?: string;
  @ApiPropertyOptional({ enum: Gender }) @IsOptional() @IsEnum(Gender) gender?: Gender;
  @ApiPropertyOptional({ enum: MaritalStatus }) @IsOptional() @IsEnum(MaritalStatus) maritalStatus?: MaritalStatus;

  @ApiPropertyOptional({ example: '1993-04-18' })
  @IsOptional()
  @Transform(dateOnly)
  @IsDateString({ strict: true })
  dateOfBirth?: string;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() bloodGroupId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) highestQualification?: string;

  @ApiProperty({ example: 'jane.doe@company.com' }) @IsEmail() emailId!: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() secondaryEmailId?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(PHONE, { message: 'contactNumber is not a valid phone' }) contactNumber?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(PHONE, { message: 'alterMobileNumber is not a valid phone' }) alterMobileNumber?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(PHONE, { message: 'emergencyContactNumber is not a valid phone' }) emergencyContactNumber?: string;

  @ApiProperty({ example: '2024-06-03' })
  @Transform(dateOnly)
  @IsDateString({ strict: true })
  dateOfJoining!: string;

  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsOptional()
  @Transform(dateOnly)
  @IsDateString({ strict: true })
  dateOfResign?: string;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() departmentId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() designationId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() defaultBranchId?: string;
  @ApiPropertyOptional({ type: [String], description: 'All branches the employee can work at' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  branchIds?: string[];
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() workShiftId?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Manager (employee id)' }) @IsOptional() @IsUUID() reportsToId?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDepartmentHead?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isTravelTrackable?: boolean;

  @ApiPropertyOptional({ example: 45000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999)
  basicPay?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) pfUANNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) esiRefNo?: string;
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class EmployeeQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() departmentId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() designationId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() branchId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() reportsToId?: string;
  @ApiPropertyOptional({ description: 'Filter by active flag' })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isActive?: boolean;
}

export class EmployeeDto extends OmitType(CreateEmployeeDto, ['branchIds'] as const) {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() isActive!: boolean;
  @ApiPropertyOptional() profileImagePath?: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

// ---- addresses ----
export class CreateEmployeeAddressDto {
  @ApiPropertyOptional({ enum: ['CURRENT', 'PERMANENT'], default: 'CURRENT' })
  @IsOptional()
  @IsEnum({ CURRENT: 'CURRENT', PERMANENT: 'PERMANENT' })
  type?: 'CURRENT' | 'PERMANENT';
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(300) addressLine!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) district?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) pincode?: string;
}
export class UpdateEmployeeAddressDto extends PartialType(CreateEmployeeAddressDto) {}

// ---- bank accounts ----
export class CreateBankAccountDto {
  @ApiProperty({ example: 'HDFC Bank' }) @IsString() @MinLength(2) @MaxLength(100) bankName!: string;
  @ApiProperty({ example: '501002345678' }) @Matches(/^[0-9A-Za-z]{6,34}$/, { message: 'accountNumber is invalid' }) accountNumber!: string;
  @ApiProperty({ example: 'HDFC0001234' }) @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'ifscCode must be a valid IFSC (e.g. HDFC0001234)' }) ifscCode!: string;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isPrimary?: boolean;
}
export class UpdateBankAccountDto extends PartialType(CreateBankAccountDto) {}

export class EmployeeIdParamDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() employeeId!: string;
}
export class EmployeeSubIdParamDto extends EmployeeIdParamDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() id!: string;
}
