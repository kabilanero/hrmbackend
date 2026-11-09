import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EmployeeAccessService } from './employee-access.service';
import {
  CreateBankAccountDto,
  CreateEmployeeAddressDto,
  UpdateBankAccountDto,
  UpdateEmployeeAddressDto,
} from './dto/employee.dto';

/** Employee-owned child resources: addresses and bank accounts. */
@Injectable()
export class EmployeeDetailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EmployeeAccessService,
  ) {}

  // ---------- addresses ----------
  async listAddresses(employeeId: string, user: AuthenticatedUser) {
    await this.access.assertCanView(user, employeeId);
    return this.prisma.employeeAddress.findMany({ where: { employeeId }, orderBy: { createdAt: 'asc' } });
  }

  async createAddress(employeeId: string, dto: CreateEmployeeAddressDto, user: AuthenticatedUser) {
    this.access.assertSelfOrHr(user, employeeId);
    return this.prisma.employeeAddress.create({ data: { ...dto, employeeId } });
  }

  async updateAddress(employeeId: string, id: string, dto: UpdateEmployeeAddressDto, user: AuthenticatedUser) {
    this.access.assertSelfOrHr(user, employeeId);
    await this.getAddress(employeeId, id);
    return this.prisma.employeeAddress.update({ where: { id }, data: dto });
  }

  async removeAddress(employeeId: string, id: string, user: AuthenticatedUser) {
    this.access.assertSelfOrHr(user, employeeId);
    await this.getAddress(employeeId, id);
    await this.prisma.employeeAddress.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async getAddress(employeeId: string, id: string) {
    const row = await this.prisma.employeeAddress.findFirst({ where: { id, employeeId } });
    if (!row) throw new NotFoundException('Address not found');
    return row;
  }

  // ---------- bank accounts ----------
  async listBankAccounts(employeeId: string, user: AuthenticatedUser) {
    this.access.assertSelfOrHr(user, employeeId); // financial data: self or HR only
    return this.prisma.bankAccount.findMany({ where: { employeeId }, orderBy: { createdAt: 'asc' } });
  }

  async createBankAccount(employeeId: string, dto: CreateBankAccountDto, user: AuthenticatedUser) {
    this.access.assertSelfOrHr(user, employeeId);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.bankAccount.updateMany({ where: { employeeId }, data: { isPrimary: false } });
      }
      return tx.bankAccount.create({ data: { ...dto, employeeId } });
    });
  }

  async updateBankAccount(employeeId: string, id: string, dto: UpdateBankAccountDto, user: AuthenticatedUser) {
    this.access.assertSelfOrHr(user, employeeId);
    await this.getBankAccount(employeeId, id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.bankAccount.updateMany({ where: { employeeId, NOT: { id } }, data: { isPrimary: false } });
      }
      return tx.bankAccount.update({ where: { id }, data: dto });
    });
  }

  async removeBankAccount(employeeId: string, id: string, user: AuthenticatedUser) {
    this.access.assertSelfOrHr(user, employeeId);
    await this.getBankAccount(employeeId, id);
    await this.prisma.bankAccount.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async getBankAccount(employeeId: string, id: string) {
    const row = await this.prisma.bankAccount.findFirst({ where: { id, employeeId } });
    if (!row) throw new NotFoundException('Bank account not found');
    return row;
  }
}
