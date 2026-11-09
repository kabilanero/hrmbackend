import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export class CreateBloodGroupDto {
  @ApiProperty({ enum: BLOOD_GROUPS, example: 'O+' })
  @IsIn(BLOOD_GROUPS as unknown as string[])
  name!: string;
}
export class UpdateBloodGroupDto extends PartialType(CreateBloodGroupDto) {}
export class BloodGroupDto extends CreateBloodGroupDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() createdAt!: Date;
}
