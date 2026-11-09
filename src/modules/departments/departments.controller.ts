import { Inject } from '@nestjs/common';
import { createCrudController } from '../../common/base/crud-controller.factory';
import { DepartmentDto, CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { DepartmentsService } from './departments.service';

export class DepartmentsController extends createCrudController({
  path: 'departments',
  tag: 'Departments',
  label: 'departments',
  createDto: CreateDepartmentDto,
  updateDto: UpdateDepartmentDto,
  responseDto: DepartmentDto,
}) {
  constructor(@Inject(DepartmentsService) service: DepartmentsService) {
    super(service);
  }
}
