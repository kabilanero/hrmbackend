import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/base/base-crud.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

@Injectable()
export class DepartmentsService extends BaseCrudService<CreateDepartmentDto, UpdateDepartmentDto> {
  constructor(prisma: PrismaService) {
    super(prisma.department, {
      entityName: 'Department',
      searchFields: ['name', 'description'],
      sortableFields: ['name', 'createdAt', 'updatedAt'],
      defaultSort: { name: 'asc' },
    });
  }
}
