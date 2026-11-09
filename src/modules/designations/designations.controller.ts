import { Inject } from '@nestjs/common';
import { createCrudController } from '../../common/base/crud-controller.factory';
import { DesignationDto, CreateDesignationDto, UpdateDesignationDto } from './dto/designation.dto';
import { DesignationsService } from './designations.service';

export class DesignationsController extends createCrudController({
  path: 'designations',
  tag: 'Designations',
  label: 'designations',
  createDto: CreateDesignationDto,
  updateDto: UpdateDesignationDto,
  responseDto: DesignationDto,
}) {
  constructor(@Inject(DesignationsService) service: DesignationsService) {
    super(service);
  }
}
