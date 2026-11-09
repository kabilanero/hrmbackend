import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttendanceStatus, LeaveStatus } from '@prisma/client';
import { AppConfig } from '../../config/configuration';
import { todayInTz } from '../../common/utils/date.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class DashboardService {
  private readonly timezone: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.timezone = config.get('timezone', { infer: true });
  }

  async summary() {
    const today = todayInTz(this.timezone);
    const [active, inactive, byDepartment, byGender, byDesignation, pendingLeaves, onLeaveToday, presentToday, holidays] =
      await Promise.all([
        this.prisma.employee.count({ where: { isActive: true } }),
        this.prisma.employee.count({ where: { isActive: false } }),
        this.prisma.employee.groupBy({ by: ['departmentId'], where: { isActive: true }, _count: { _all: true } }),
        this.prisma.employee.groupBy({ by: ['gender'], where: { isActive: true }, _count: { _all: true } }),
        this.prisma.employee.groupBy({ by: ['designationId'], where: { isActive: true }, _count: { _all: true } }),
        this.prisma.leaveApply.count({ where: { status: LeaveStatus.PENDING } }),
        this.prisma.leaveApply.count({
          where: { status: LeaveStatus.APPROVED, startDate: { lte: today }, endDate: { gte: today } },
        }),
        this.prisma.attendance.count({
          where: { date: today, status: { in: [AttendanceStatus.PRESENT, AttendanceStatus.HALF_DAY] } },
        }),
        this.prisma.nationalHoliday.findMany({
          where: { date: { gte: today }, isActive: true },
          orderBy: { date: 'asc' },
          take: 5,
          select: { id: true, name: true, date: true },
        }),
      ]);

    const [departments, designations] = await Promise.all([
      this.prisma.department.findMany({ select: { id: true, name: true } }),
      this.prisma.designation.findMany({ select: { id: true, name: true } }),
    ]);
    const dName = new Map(departments.map((d) => [d.id, d.name]));
    const gName = new Map(designations.map((d) => [d.id, d.name]));

    return {
      employees: { active, inactive, total: active + inactive },
      today: { date: today.toISOString().slice(0, 10), present: presentToday, onLeave: onLeaveToday },
      pendingLeaves,
      byDepartment: byDepartment.map((r) => ({
        departmentId: r.departmentId,
        name: r.departmentId ? dName.get(r.departmentId) ?? 'Unknown' : 'Unassigned',
        count: r._count._all,
      })),
      byDesignation: byDesignation.map((r) => ({
        designationId: r.designationId,
        name: r.designationId ? gName.get(r.designationId) ?? 'Unknown' : 'Unassigned',
        count: r._count._all,
      })),
      byGender: byGender.map((r) => ({ gender: r.gender ?? 'UNSPECIFIED', count: r._count._all })),
      upcomingHolidays: holidays,
    };
  }
}
