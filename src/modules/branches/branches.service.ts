import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/base/base-crud.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

@Injectable()
export class BranchesService extends BaseCrudService<CreateBranchDto, UpdateBranchDto> {
  constructor(prisma: PrismaService) {
    super(prisma.branch, {
      entityName: 'Branch',
      searchFields: ['name', 'code', 'city', 'state'],
      sortableFields: ['name', 'code', 'city', 'createdAt'],
      defaultSort: { name: 'asc' },
    });
  }
}
