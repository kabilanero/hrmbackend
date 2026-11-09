import { Inject } from '@nestjs/common';
import { createCrudController } from '../../common/base/crud-controller.factory';
import { HolidayDto, CreateHolidayDto, UpdateHolidayDto } from './dto/holiday.dto';
import { HolidaysService } from './holidays.service';

export class HolidaysController extends createCrudController({
  path: 'holidays',
  tag: 'Holidays',
  label: 'holidays',
  createDto: CreateHolidayDto,
  updateDto: UpdateHolidayDto,
  responseDto: HolidayDto,
}) {
  constructor(@Inject(HolidaysService) service: HolidaysService) {
    super(service);
  }
}
