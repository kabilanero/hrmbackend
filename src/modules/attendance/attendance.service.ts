import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttendanceStatus, LeaveStatus, Prisma } from '@prisma/client';
import { RoleName } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AppConfig } from '../../config/configuration';
import { eachDay, monthRange, todayInTz, toDateOnly } from '../../common/utils/date.util';
import { Paginated } from '../../common/utils/paginated';
import { parseSort } from '../../common/utils/query.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EmployeeAccessService } from '../employees/employee-access.service';
import { AttendanceQueryDto, MonthlyAttendanceQueryDto, UpsertAttendanceDto } from './dto/attendance.dto';

@Injectable()
export class AttendanceService {
  private readonly timezone: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EmployeeAccessService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.timezone = config.get('timezone', { infer: true });
  }

  private minutesBetween(a: Date, b: Date) {
    return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
  }

  /** Employee punches in for "today" (in APP_TIMEZONE). One record per employee per day. */
  async punchIn(user: AuthenticatedUser) {
    const employeeId = this.access.requireOwnEmployeeId(user);
    const date = todayInTz(this.timezone);
    const existing = await this.prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date } },
    });
    if (existing?.punchIn) throw new ConflictException('You have already punched in today');

    const now = new Date();
    return existing
      ? this.prisma.attendance.update({ where: { id: existing.id }, data: { punchIn: now, status: AttendanceStatus.PRESENT } })
      : this.prisma.attendance.create({ data: { employeeId, date, punchIn: now, status: AttendanceStatus.PRESENT } });
  }

  async punchOut(user: AuthenticatedUser) {
    const employeeId = this.access.requireOwnEmployeeId(user);
    const date = todayInTz(this.timezone);
    const record = await this.prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date } },
      include: { employee: { include: { workShift: true } } },
    });
    if (!record?.punchIn) throw new BadRequestException('You have not punched in today');
    if (record.punchOut) throw new ConflictException('You have already punched out today');

    const now = new Date();
    const workedMinutes = this.minutesBetween(record.punchIn, now);
    const shiftMin = record.employee.workShift?.durationMin;
    const status =
      shiftMin && workedMinutes < shiftMin / 2 ? AttendanceStatus.HALF_DAY : AttendanceStatus.PRESENT;

    return this.prisma.attendance.update({
      where: { id: record.id },
      data: { punchOut: now, workedMinutes, status },
    });
  }

  async today(user: AuthenticatedUser) {
    const employeeId = this.access.requireOwnEmployeeId(user);
    const record = await this.prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: todayInTz(this.timezone) } },
    });
    return record ?? { employeeId, date: todayInTz(this.timezone), punchIn: null, punchOut: null };
  }

  /** HR/Admin: create or correct a day's record. */
  async upsert(dto: UpsertAttendanceDto) {
    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const date = toDateOnly(dto.date);
    const punchIn = dto.punchIn ? new Date(dto.punchIn) : undefined;
    const punchOut = dto.punchOut ? new Date(dto.punchOut) : undefined;
    if (punchIn && punchOut && punchOut <= punchIn) {
      throw new BadRequestException('punchOut must be after punchIn');
    }
    const data: Omit<Prisma.AttendanceUncheckedUpdateInput, 'employeeId' | 'date'> = {
      ...(punchIn ? { punchIn } : {}),
      ...(punchOut ? { punchOut } : {}),
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
      ...(punchIn && punchOut ? { workedMinutes: this.minutesBetween(punchIn, punchOut) } : {}),
    };
    return this.prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: dto.employeeId, date } },
      create: {
        ...(data as Omit<Prisma.AttendanceUncheckedCreateInput, 'employeeId' | 'date'>),
        employeeId: dto.employeeId,
        date,
      },
      update: data,
    });
  }

  async findAll(query: AttendanceQueryDto, user: AuthenticatedUser) {
    const where: Prisma.AttendanceWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: toDateOnly(query.from) } : {}),
              ...(query.to ? { lte: toDateOnly(query.to) } : {}),
            },
          }
        : {}),
    };
    if (query.employeeId) {
      await this.access.assertCanView(user, query.employeeId);
      where.employeeId = query.employeeId;
    } else if (!this.access.isHr(user)) {
      const own = this.access.requireOwnEmployeeId(user);
      where.employee =
        user.role === RoleName.MANAGER ? { OR: [{ id: own }, { reportsToId: own }] } : { id: own };
    }

    const orderBy = parseSort(query.sort, ['date', 'punchIn', 'status'], { date: 'desc' });
    const [items, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        orderBy,
        include: { employee: { select: { id: true, employeeCode: true, employeeName: true } } },
        skip: (query.page - 1) * query.size,
        take: query.size,
      }),
      this.prisma.attendance.count({ where }),
    ]);
    return Paginated.of(items, total, query.page, query.size);
  }

  /**
   * Month calendar for one employee. Days without a punch record are derived:
   * holiday > approved leave > weekend > (past) absent > (future) null.
   */
  async monthly(query: MonthlyAttendanceQueryDto, user: AuthenticatedUser) {
    const employeeId = query.employeeId ?? this.access.requireOwnEmployeeId(user);
    await this.access.assertCanView(user, employeeId);
    const { from, to } = monthRange(query.year, query.month);
    const today = todayInTz(this.timezone);

    const [records, holidays, leaves] = await Promise.all([
      this.prisma.attendance.findMany({ where: { employeeId, date: { gte: from, lte: to } } }),
      this.prisma.nationalHoliday.findMany({ where: { date: { gte: from, lte: to }, isActive: true } }),
      this.prisma.leaveApply.findMany({
        where: { employeeId, status: LeaveStatus.APPROVED, startDate: { lte: to }, endDate: { gte: from } },
      }),
    ]);
    const byDate = new Map(records.map((r) => [r.date.toISOString().slice(0, 10), r]));
    const holidayByDate = new Map(holidays.map((h) => [h.date.toISOString().slice(0, 10), h.name]));

    const summary = { present: 0, halfDay: 0, absent: 0, onLeave: 0, holidays: 0, weekOffs: 0, workedMinutes: 0 };
    const days = [...eachDay(from, to)].map((d) => {
      const key = d.toISOString().slice(0, 10);
      const rec = byDate.get(key);
      const dow = d.getUTCDay();
      let status: AttendanceStatus | null;
      if (rec) status = rec.status;
      else if (holidayByDate.has(key)) status = AttendanceStatus.HOLIDAY;
      else if (leaves.some((l) => l.startDate <= d && l.endDate >= d)) status = AttendanceStatus.ON_LEAVE;
      else if (dow === 0 || dow === 6) status = AttendanceStatus.WEEK_OFF;
      else status = d < today ? AttendanceStatus.ABSENT : null;

      switch (status) {
        case AttendanceStatus.PRESENT: summary.present++; break;
        case AttendanceStatus.HALF_DAY: summary.halfDay++; break;
        case AttendanceStatus.ABSENT: summary.absent++; break;
        case AttendanceStatus.ON_LEAVE: summary.onLeave++; break;
        case AttendanceStatus.HOLIDAY: summary.holidays++; break;
        case AttendanceStatus.WEEK_OFF: summary.weekOffs++; break;
      }
      summary.workedMinutes += rec?.workedMinutes ?? 0;
      return {
        date: key,
        status,
        punchIn: rec?.punchIn ?? null,
        punchOut: rec?.punchOut ?? null,
        workedMinutes: rec?.workedMinutes ?? 0,
        holiday: holidayByDate.get(key) ?? null,
      };
    });
    return { employeeId, year: query.year, month: query.month, summary, days };
  }
}
