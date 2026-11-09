import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RoleName } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/**
 * Centralised row-level access rules for employee-owned data:
 *  - ADMIN / HR   : everything
 *  - MANAGER      : self + direct reportees (read)
 *  - EMPLOYEE     : self only
 */
@Injectable()
export class EmployeeAccessService {
  constructor(private readonly prisma: PrismaService) {}

  isHr(user: AuthenticatedUser) {
    return user.role === RoleName.ADMIN || user.role === RoleName.HR;
  }

  /** Resolves the employee id of the caller or throws if the login is not linked to one. */
  requireOwnEmployeeId(user: AuthenticatedUser): string {
    if (!user.employeeId) {
      throw new ForbiddenException('Your login is not linked to an employee record');
    }
    return user.employeeId;
  }

  async assertCanView(user: AuthenticatedUser, employeeId: string): Promise<void> {
    if (this.isHr(user) || user.employeeId === employeeId) return;
    if (user.role === RoleName.MANAGER && user.employeeId) {
      const target = await this.prisma.employee.findUnique({
        where: { id: employeeId },
        select: { reportsToId: true },
      });
      if (!target) throw new NotFoundException('Employee not found');
      if (target.reportsToId === user.employeeId) return;
    }
    throw new ForbiddenException('You cannot access this employee');
  }

  assertSelfOrHr(user: AuthenticatedUser, employeeId: string): void {
    if (this.isHr(user) || user.employeeId === employeeId) return;
    throw new ForbiddenException('You can only change your own data');
  }
}
