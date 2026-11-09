import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/base/base-crud.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateWorkShiftDto, UpdateWorkShiftDto } from './dto/work-shift.dto';

@Injectable()
export class WorkShiftsService extends BaseCrudService<CreateWorkShiftDto, UpdateWorkShiftDto> {
  constructor(prisma: PrismaService) {
    super(prisma.workShift, {
      entityName: 'WorkShift',
      searchFields: ['name'],
      sortableFields: ['name', 'startTime', 'createdAt'],
      defaultSort: { name: 'asc' },
    });
  }
}
