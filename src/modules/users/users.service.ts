import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Paginated } from '../../common/utils/paginated';
import { buildSearch, parseSort } from '../../common/utils/query.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  private static shape(u: any) {
    return {
      id: u.id,
      email: u.email,
      role: u.role.name,
      employeeId: u.employeeId,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    };
  }

  async findAll(query: PaginationQueryDto) {
    const where = buildSearch(query.search, ['email', 'userName']) ?? {};
    const orderBy = parseSort(query.sort, ['email', 'createdAt', 'lastLoginAt']);
    const [rows, total] = await Promise.all([
      this.prisma.userAccount.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.size,
        take: query.size,
        include: { role: true },
      }),
      this.prisma.userAccount.count({ where }),
    ]);
    return Paginated.of(rows.map(UsersService.shape), total, query.page, query.size);
  }

  async findOne(id: string) {
    const user = await this.prisma.userAccount.findUnique({ where: { id }, include: { role: true } });
    if (!user) throw new NotFoundException('User not found');
    return UsersService.shape(user);
  }

  async create(dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    const role = await this.prisma.role.findUnique({ where: { name: dto.role } });
    if (!role) throw new BadRequestException(`Role ${dto.role} does not exist`);
    if (await this.prisma.userAccount.findUnique({ where: { email } })) {
      throw new ConflictException('A user with this email already exists');
    }
    if (dto.employeeId) {
      const emp = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
      if (!emp) throw new BadRequestException('employeeId does not exist');
    }

    const { data, error } = await this.supabase.admin.auth.admin.createUser({
      email,
      password: dto.password,
      email_confirm: true,
    });
    if (error || !data.user) throw new BadRequestException(error?.message ?? 'Unable to create the user');

    try {
      const created = await this.prisma.userAccount.create({
        data: { id: data.user.id, email, roleId: role.id, employeeId: dto.employeeId },
        include: { role: true },
      });
      return UsersService.shape(created);
    } catch (e) {
      await this.supabase.admin.auth.admin.deleteUser(data.user.id).catch(() => undefined);
      throw e;
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    const data: Record<string, unknown> = {};
    if (dto.role) {
      const role = await this.prisma.role.findUnique({ where: { name: dto.role } });
      if (!role) throw new BadRequestException(`Role ${dto.role} does not exist`);
      data.roleId = role.id;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.employeeId !== undefined) data.employeeId = dto.employeeId;

    const updated = await this.prisma.userAccount.update({ where: { id }, data, include: { role: true } });
    if (dto.isActive === false) {
      // ban the Supabase user so existing refresh tokens stop working
      await this.supabase.admin.auth.admin.updateUserById(id, { ban_duration: '876000h' });
    } else if (dto.isActive === true) {
      await this.supabase.admin.auth.admin.updateUserById(id, { ban_duration: 'none' });
    }
    return UsersService.shape(updated);
  }

  async remove(id: string, actingUserId: string) {
    if (id === actingUserId) throw new BadRequestException('You cannot delete your own account');
    await this.findOne(id);
    await this.prisma.userAccount.delete({ where: { id } });
    await this.supabase.admin.auth.admin.deleteUser(id);
    return { id, deleted: true };
  }

  listRoles() {
    return this.prisma.role.findMany({ orderBy: { name: 'asc' } });
  }
}
