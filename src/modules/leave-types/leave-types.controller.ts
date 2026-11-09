import { Inject } from '@nestjs/common';
import { createCrudController } from '../../common/base/crud-controller.factory';
import { LeaveTypeDto, CreateLeaveTypeDto, UpdateLeaveTypeDto } from './dto/leave-type.dto';
import { LeaveTypesService } from './leave-types.service';

export class LeaveTypesController extends createCrudController({
  path: 'leave-types',
  tag: 'Leave types',
  label: 'leave types',
  createDto: CreateLeaveTypeDto,
  updateDto: UpdateLeaveTypeDto,
  responseDto: LeaveTypeDto,
}) {
  constructor(@Inject(LeaveTypesService) service: LeaveTypesService) {
    super(service);
  }
}
