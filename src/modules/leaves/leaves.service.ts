import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaveStatus, Prisma } from '@prisma/client';
import { RoleName } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { Paginated } from '../../common/utils/paginated';
import { eachDay, toDateOnly } from '../../common/utils/date.util';
import { parseSort } from '../../common/utils/query.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EmployeeAccessService } from '../employees/employee-access.service';
import { ApplyLeaveDto, LeaveBalanceQueryDto, LeaveDecisionDto, LeaveQueryDto } from './dto/leave.dto';

const INCLUDE = {
  leaveType: { select: { id: true, code: true, name: true } },
  employee: { select: { id: true, employeeCode: true, employeeName: true } },
  approver: { select: { id: true, employeeName: true } },
} satisfies Prisma.LeaveApplyInclude;

@Injectable()
export class LeavesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EmployeeAccessService,
  ) {}

  /**
   * Working days between two dates (inclusive): Saturdays, Sundays and active
   * national holidays are not counted.
   */
  private async countWorkingDays(start: Date, end: Date): Promise<number> {
    const holidays = await this.prisma.nationalHoliday.findMany({
      where: { date: { gte: start, lte: end }, isActive: true },
      select: { date: true },
    });
    const holidaySet = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));
    let days = 0;
    for (const d of eachDay(start, end)) {
      const dow = d.getUTCDay();
      if (dow === 0 || dow === 6) continue;
      if (holidaySet.has(d.toISOString().slice(0, 10))) continue;
      days++;
    }
    return days;
  }

  async apply(dto: ApplyLeaveDto, user: AuthenticatedUser) {
    const start = toDateOnly(dto.startDate);
    const end = toDateOnly(dto.endDate);
    if (end < start) throw new BadRequestException('endDate cannot be before startDate');

    const employeeId =
      dto.employeeId && dto.employeeId !== user.employeeId
        ? this.assertHrForOthers(user, dto.employeeId)
        : this.access.requireOwnEmployeeId(user);

    const [employee, leaveType] = await Promise.all([
      this.prisma.employee.findUnique({ where: { id: employeeId } }),
      this.prisma.leaveType.findUnique({ where: { id: dto.leaveTypeId } }),
    ]);
    if (!employee || !employee.isActive) throw new BadRequestException('Employee not found or inactive');
    if (!leaveType || !leaveType.isActive) throw new BadRequestException('Leave type not found or inactive');

    const noOfDays = await this.countWorkingDays(start, end);
    if (noOfDays === 0) {
      throw new BadRequestException('The selected range contains no working days');
    }

    const overlap = await this.prisma.leaveApply.findFirst({
      where: {
        employeeId,
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    if (overlap) throw new ConflictException('A pending or approved leave already overlaps these dates');

    if (leaveType.maxDaysYear > 0) {
      const year = start.getUTCFullYear();
      const used = await this.sumDays(employeeId, leaveType.id, year, [LeaveStatus.PENDING, LeaveStatus.APPROVED]);
      if (used + noOfDays > leaveType.maxDaysYear) {
        throw new BadRequestException(
          `Insufficient ${leaveType.name} balance: ${leaveType.maxDaysYear - used} day(s) left, ${noOfDays} requested`,
        );
      }
    }

    return this.prisma.leaveApply.create({
      data: {
        employeeId,
        leaveTypeId: leaveType.id,
        startDate: start,
        endDate: end,
        noOfDays,
        reason: dto.reason,
      },
      include: INCLUDE,
    });
  }

  private assertHrForOthers(user: AuthenticatedUser, employeeId: string): string {
    if (!this.access.isHr(user)) {
      throw new ForbiddenException('Only HR/Admin can apply leave on behalf of another employee');
    }
    return employeeId;
  }

  private async sumDays(employeeId: string, leaveTypeId: string, year: number, statuses: LeaveStatus[]) {
    const agg = await this.prisma.leaveApply.aggregate({
      _sum: { noOfDays: true },
      where: {
        employeeId,
        leaveTypeId,
        status: { in: statuses },
        startDate: { gte: new Date(Date.UTC(year, 0, 1)), lte: new Date(Date.UTC(year, 11, 31)) },
      },
    });
    return Number(agg._sum.noOfDays ?? 0);
  }

  async findAll(query: LeaveQueryDto, user: AuthenticatedUser) {
    const where: Prisma.LeaveApplyWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.leaveTypeId ? { leaveTypeId: query.leaveTypeId } : {}),
      ...(query.from ? { endDate: { gte: toDateOnly(query.from) } } : {}),
      ...(query.to ? { startDate: { lte: toDateOnly(query.to) } } : {}),
    };

    if (query.employeeId) {
      await this.access.assertCanView(user, query.employeeId);
      where.employeeId = query.employeeId;
    } else if (!this.access.isHr(user)) {
      const own = this.access.requireOwnEmployeeId(user);
      where.employee =
        user.role === RoleName.MANAGER
          ? { OR: [{ id: own }, { reportsToId: own }] }
          : { id: own };
    }

    const orderBy = parseSort(query.sort, ['startDate', 'endDate', 'createdAt', 'status'], { createdAt: 'desc' });
    const [items, total] = await Promise.all([
      this.prisma.leaveApply.findMany({
        where,
        orderBy,
        include: INCLUDE,
        skip: (query.page - 1) * query.size,
        take: query.size,
      }),
      this.prisma.leaveApply.count({ where }),
    ]);
    return Paginated.of(items, total, query.page, query.size);
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const leave = await this.prisma.leaveApply.findUnique({ where: { id }, include: INCLUDE });
    if (!leave) throw new NotFoundException('Leave application not found');
    await this.access.assertCanView(user, leave.employeeId);
    return leave;
  }

  async decide(id: string, dto: LeaveDecisionDto, user: AuthenticatedUser) {
    const leave = await this.prisma.leaveApply.findUnique({ where: { id }, include: { employee: true } });
    if (!leave) throw new NotFoundException('Leave application not found');
    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(`Only pending leaves can be decided (current: ${leave.status})`);
    }
    this.assertCanDecide(user, leave.employeeId, leave.employee.reportsToId);

    return this.prisma.leaveApply.update({
      where: { id },
      data: {
        status: dto.status === 'APPROVED' ? LeaveStatus.APPROVED : LeaveStatus.REJECTED,
        approverId: user.employeeId,
        approvedAt: new Date(),
        remarks: dto.remarks,
      },
      include: INCLUDE,
    });
  }

  async revoke(id: string, remarks: string | undefined, user: AuthenticatedUser) {
    const leave = await this.prisma.leaveApply.findUnique({ where: { id }, include: { employee: true } });
    if (!leave) throw new NotFoundException('Leave application not found');
    if (leave.status !== LeaveStatus.APPROVED) {
      throw new BadRequestException('Only approved leaves can be revoked');
    }
    this.assertCanDecide(user, leave.employeeId, leave.employee.reportsToId);
    return this.prisma.leaveApply.update({
      where: { id },
      data: { status: LeaveStatus.REVOKED, approverId: user.employeeId, approvedAt: new Date(), remarks },
      include: INCLUDE,
    });
  }

  async cancel(id: string, user: AuthenticatedUser) {
    const leave = await this.prisma.leaveApply.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException('Leave application not found');
    this.access.assertSelfOrHr(user, leave.employeeId);
    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Only pending leaves can be cancelled');
    }
    return this.prisma.leaveApply.update({
      where: { id },
      data: { status: LeaveStatus.CANCELLED },
      include: INCLUDE,
    });
  }

  /** Approval authority: admin, HR, or the applicant's direct manager — never the applicant themself. */
  private assertCanDecide(user: AuthenticatedUser, applicantId: string, applicantManagerId: string | null) {
    if (user.employeeId && user.employeeId === applicantId && user.role !== RoleName.ADMIN) {
      throw new ForbiddenException('You cannot decide your own leave');
    }
    if (this.access.isHr(user)) return;
    if (user.role === RoleName.MANAGER && user.employeeId && applicantManagerId === user.employeeId) return;
    throw new ForbiddenException('Only HR, admin or the reporting manager can decide this leave');
  }

  async balance(query: LeaveBalanceQueryDto, user: AuthenticatedUser) {
    const employeeId = query.employeeId ?? this.access.requireOwnEmployeeId(user);
    await this.access.assertCanView(user, employeeId);
    const year = query.year ?? new Date().getUTCFullYear();

    const types = await this.prisma.leaveType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    return Promise.all(
      types.map(async (t) => {
        const [used, pending] = await Promise.all([
          this.sumDays(employeeId, t.id, year, [LeaveStatus.APPROVED]),
          this.sumDays(employeeId, t.id, year, [LeaveStatus.PENDING]),
        ]);
        return {
          leaveTypeId: t.id,
          code: t.code,
          name: t.name,
          year,
          entitled: t.maxDaysYear,
          used,
          pending,
          remaining: t.maxDaysYear > 0 ? Math.max(0, t.maxDaysYear - used - pending) : null,
        };
      }),
    );
  }
}
