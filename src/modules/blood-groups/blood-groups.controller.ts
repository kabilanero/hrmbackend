import { Inject } from '@nestjs/common';
import { createCrudController } from '../../common/base/crud-controller.factory';
import { BloodGroupDto, CreateBloodGroupDto, UpdateBloodGroupDto } from './dto/blood-group.dto';
import { BloodGroupsService } from './blood-groups.service';

export class BloodGroupsController extends createCrudController({
  path: 'blood-groups',
  tag: 'Blood groups',
  label: 'blood groups',
  createDto: CreateBloodGroupDto,
  updateDto: UpdateBloodGroupDto,
  responseDto: BloodGroupDto,
}) {
  constructor(@Inject(BloodGroupsService) service: BloodGroupsService) {
    super(service);
  }
}
