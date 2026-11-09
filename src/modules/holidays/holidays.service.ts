import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/base/base-crud.service';
import { toDateOnly } from '../../common/utils/date.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateHolidayDto, UpdateHolidayDto } from './dto/holiday.dto';

@Injectable()
export class HolidaysService extends BaseCrudService<CreateHolidayDto, UpdateHolidayDto> {
  constructor(private readonly prisma: PrismaService) {
    super(prisma.nationalHoliday, {
      entityName: 'Holiday',
      searchFields: ['name'],
      sortableFields: ['date', 'name', 'createdAt'],
      defaultSort: { date: 'asc' },
    });
  }

  override create(dto: CreateHolidayDto) {
    const date = toDateOnly(dto.date);
    return this.prisma.nationalHoliday.create({
      data: { ...dto, date, year: date.getUTCFullYear() },
    });
  }

  override async update(id: string, dto: UpdateHolidayDto) {
    await this.findOne(id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.date) {
      const date = toDateOnly(dto.date);
      data.date = date;
      data.year = date.getUTCFullYear();
    }
    return this.prisma.nationalHoliday.update({ where: { id }, data });
  }
}
