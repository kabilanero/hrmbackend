import { ApiProperty } from '@nestjs/swagger';

/** Common columns returned by every persisted resource (Swagger response shape). */
export class BaseEntityDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
