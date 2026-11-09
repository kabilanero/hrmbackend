import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/base/base-crud.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateLeaveTypeDto, UpdateLeaveTypeDto } from './dto/leave-type.dto';

@Injectable()
export class LeaveTypesService extends BaseCrudService<CreateLeaveTypeDto, UpdateLeaveTypeDto> {
  constructor(prisma: PrismaService) {
    super(prisma.leaveType, {
      entityName: 'LeaveType',
      searchFields: ['name', 'code'],
      sortableFields: ['name', 'code', 'createdAt'],
      defaultSort: { name: 'asc' },
    });
  }
}
