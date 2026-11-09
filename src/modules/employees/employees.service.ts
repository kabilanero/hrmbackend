import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RoleName } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { Paginated } from '../../common/utils/paginated';
import { toDateOnly } from '../../common/utils/date.util';
import { buildSearch, parseSort } from '../../common/utils/query.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SupabaseStorageService } from '../../infrastructure/supabase/supabase-storage.service';
import { EmployeeAccessService } from './employee-access.service';
import { CreateEmployeeDto, EmployeeQueryDto, UpdateEmployeeDto } from './dto/employee.dto';

const INCLUDE = {
  department: { select: { id: true, name: true } },
  designation: { select: { id: true, name: true } },
  defaultBranch: { select: { id: true, name: true, code: true } },
  workShift: { select: { id: true, name: true, startTime: true, endTime: true } },
  bloodGroup: { select: { id: true, name: true } },
  reportsTo: { select: { id: true, employeeName: true, employeeCode: true } },
  branches: { select: { branch: { select: { id: true, name: true, code: true } } } },
} satisfies Prisma.EmployeeInclude;

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EmployeeAccessService,
    private readonly storage: SupabaseStorageService,
  ) {}

  private static shape<T extends { branches?: { branch: unknown }[] }>(e: T) {
    return { ...e, branches: e.branches?.map((b) => b.branch) };
  }

  private toData(dto: Partial<CreateEmployeeDto>) {
    const { branchIds: _b, dateOfBirth, dateOfJoining, dateOfResign, ...rest } = dto;
    return {
      ...rest,
      ...(dateOfBirth ? { dateOfBirth: toDateOnly(dateOfBirth) } : {}),
      ...(dateOfJoining ? { dateOfJoining: toDateOnly(dateOfJoining) } : {}),
      ...(dateOfResign ? { dateOfResign: toDateOnly(dateOfResign) } : {}),
      ...(rest.emailId ? { emailId: rest.emailId.toLowerCase() } : {}),
    };
  }

  async create(dto: CreateEmployeeDto) {
    if (dto.dateOfResign && dto.dateOfResign < dto.dateOfJoining) {
      throw new BadRequestException('dateOfResign cannot be before dateOfJoining');
    }
    const branchIds = new Set(dto.branchIds ?? []);
    if (dto.defaultBranchId) branchIds.add(dto.defaultBranchId);

    const created = await this.prisma.employee.create({
      data: {
        ...(this.toData(dto) as Prisma.EmployeeUncheckedCreateInput),
        branches: { create: [...branchIds].map((branchId) => ({ branchId })) },
      },
      include: INCLUDE,
    });
    return EmployeesService.shape(created);
  }

  async findAll(query: EmployeeQueryDto, user: AuthenticatedUser) {
    const where: Prisma.EmployeeWhereInput = {
      ...(buildSearch(query.search, ['employeeName', 'employeeCode', 'emailId', 'contactNumber']) ?? {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.designationId ? { designationId: query.designationId } : {}),
      ...(query.reportsToId ? { reportsToId: query.reportsToId } : {}),
      ...(query.branchId ? { branches: { some: { branchId: query.branchId } } } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };
    // managers only ever see their own team
    if (user.role === RoleName.MANAGER) {
      where.reportsToId = user.employeeId ?? '00000000-0000-0000-0000-000000000000';
    }
    const orderBy = parseSort(
      query.sort,
      ['employeeName', 'employeeCode', 'dateOfJoining', 'createdAt', 'department.name', 'designation.name'],
      { employeeName: 'asc' },
    );
    const [rows, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        orderBy,
        include: INCLUDE,
        skip: (query.page - 1) * query.size,
        take: query.size,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return Paginated.of(rows.map(EmployeesService.shape), total, query.page, query.size);
  }

  async findOne(id: string, user: AuthenticatedUser) {
    await this.access.assertCanView(user, id);
    const row = await this.prisma.employee.findUnique({ where: { id }, include: INCLUDE });
    if (!row) throw new NotFoundException('Employee not found');
    return EmployeesService.shape(row);
  }

  async findMe(user: AuthenticatedUser) {
    return this.findOne(this.access.requireOwnEmployeeId(user), user);
  }

  async reportees(id: string, user: AuthenticatedUser) {
    await this.access.assertCanView(user, id);
    return this.prisma.employee.findMany({
      where: { reportsToId: id, isActive: true },
      select: { id: true, employeeCode: true, employeeName: true, designation: { select: { name: true } } },
      orderBy: { employeeName: 'asc' },
    });
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Employee not found');
    if (dto.reportsToId === id) throw new BadRequestException('An employee cannot report to themselves');

    const joining = dto.dateOfJoining ?? existing.dateOfJoining.toISOString().slice(0, 10);
    const resign = dto.dateOfResign ?? existing.dateOfResign?.toISOString().slice(0, 10);
    if (resign && resign < joining) {
      throw new BadRequestException('dateOfResign cannot be before dateOfJoining');
    }

    const data: Prisma.EmployeeUncheckedUpdateInput = this.toData(dto) as any;
    if (dto.branchIds) {
      const ids = new Set(dto.branchIds);
      const defaultId = dto.defaultBranchId ?? existing.defaultBranchId;
      if (defaultId) ids.add(defaultId);
      data.branches = {
        deleteMany: {},
        create: [...ids].map((branchId) => ({ branchId })),
      };
    }
    const updated = await this.prisma.employee.update({ where: { id }, data, include: INCLUDE });
    return EmployeesService.shape(updated);
  }

  /** Employees are never hard-deleted (history is referenced by leave/attendance); they are deactivated. */
  async deactivate(id: string) {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Employee not found');
    await this.prisma.$transaction([
      this.prisma.employee.update({ where: { id }, data: { isActive: false } }),
      this.prisma.userAccount.updateMany({ where: { employeeId: id }, data: { isActive: false } }),
    ]);
    return { id, isActive: false };
  }

  async uploadProfileImage(id: string, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('A "file" part is required');
    const ext = IMAGE_TYPES[file.mimetype];
    if (!ext) throw new BadRequestException('Only JPEG, PNG or WebP images are allowed');

    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException('Employee not found');

    const path = `employees/${id}/profile-${Date.now()}.${ext}`;
    await this.storage.upload(path, file.buffer, file.mimetype);
    await this.prisma.employee.update({ where: { id }, data: { profileImagePath: path } });
    if (employee.profileImagePath) await this.storage.remove(employee.profileImagePath);
    return { profileImagePath: path, url: await this.storage.signedUrl(path) };
  }

  async profileImageUrl(id: string, user: AuthenticatedUser) {
    await this.access.assertCanView(user, id);
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      select: { profileImagePath: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return {
      url: employee.profileImagePath ? await this.storage.signedUrl(employee.profileImagePath) : null,
    };
  }
}
