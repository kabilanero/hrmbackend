import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/base/base-crud.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateDesignationDto, UpdateDesignationDto } from './dto/designation.dto';

@Injectable()
export class DesignationsService extends BaseCrudService<CreateDesignationDto, UpdateDesignationDto> {
  constructor(prisma: PrismaService) {
    super(prisma.designation, {
      entityName: 'Designation',
      searchFields: ['name', 'description'],
      sortableFields: ['name', 'level', 'createdAt'],
      defaultSort: { name: 'asc' },
    });
  }
}
