import { Inject } from '@nestjs/common';
import { createCrudController } from '../../common/base/crud-controller.factory';
import { BranchDto, CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';
import { BranchesService } from './branches.service';

export class BranchesController extends createCrudController({
  path: 'branches',
  tag: 'Branches',
  label: 'branches',
  createDto: CreateBranchDto,
  updateDto: UpdateBranchDto,
  responseDto: BranchDto,
}) {
  constructor(@Inject(BranchesService) service: BranchesService) {
    super(service);
  }
}
