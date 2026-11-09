import { Inject } from '@nestjs/common';
import { createCrudController } from '../../common/base/crud-controller.factory';
import { WorkShiftDto, CreateWorkShiftDto, UpdateWorkShiftDto } from './dto/work-shift.dto';
import { WorkShiftsService } from './work-shifts.service';

export class WorkShiftsController extends createCrudController({
  path: 'work-shifts',
  tag: 'Work shifts',
  label: 'work shifts',
  createDto: CreateWorkShiftDto,
  updateDto: UpdateWorkShiftDto,
  responseDto: WorkShiftDto,
}) {
  constructor(@Inject(WorkShiftsService) service: WorkShiftsService) {
    super(service);
  }
}
