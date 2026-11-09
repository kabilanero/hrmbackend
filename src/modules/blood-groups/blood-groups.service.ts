import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/base/base-crud.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateBloodGroupDto, UpdateBloodGroupDto } from './dto/blood-group.dto';

@Injectable()
export class BloodGroupsService extends BaseCrudService<CreateBloodGroupDto, UpdateBloodGroupDto> {
  constructor(prisma: PrismaService) {
    super(prisma.bloodGroup, {
      entityName: 'BloodGroup',
      searchFields: ['name'],
      sortableFields: ['name', 'createdAt'],
      defaultSort: { name: 'asc' },
    });
  }
}
