import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { RoleName } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  /** Self-service sign-up: always creates an EMPLOYEE account linked to the employee with the same email. */
  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const employee = await this.prisma.employee.findUnique({ where: { emailId: email } });
    if (!employee) {
      throw new BadRequestException('No employee record exists for this email. Ask HR to add you first.');
    }
    if (await this.prisma.userAccount.findFirst({ where: { OR: [{ email }, { employeeId: employee.id }] } })) {
      throw new ConflictException('An account already exists for this employee');
    }

    const role = await this.prisma.role.findUniqueOrThrow({ where: { name: RoleName.EMPLOYEE } });
    const { data, error } = await this.supabase.admin.auth.admin.createUser({
      email,
      password: dto.password,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new BadRequestException(error?.message ?? 'Unable to create the account');
    }

    try {
      await this.prisma.userAccount.create({
        data: { id: data.user.id, email, roleId: role.id, employeeId: employee.id },
      });
    } catch (e) {
      // keep Supabase and the app database consistent
      await this.supabase.admin.auth.admin.deleteUser(data.user.id).catch(() => undefined);
      throw e;
    }
    return { id: data.user.id, email, role: role.name, employeeId: employee.id };
  }

  async login(dto: LoginDto) {
    const { data, error } = await this.supabase.anon.auth.signInWithPassword({
      email: dto.email.toLowerCase(),
      password: dto.password,
    });
    if (error || !data.session || !data.user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const account = await this.prisma.userAccount.findUnique({
      where: { id: data.user.id },
      include: { role: true },
    });
    if (!account || !account.isActive) {
      throw new UnauthorizedException('Account is not active');
    }
    await this.prisma.userAccount.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });
    return this.toSession(data.session, {
      id: account.id,
      email: account.email,
      role: account.role.name,
      employeeId: account.employeeId,
    });
  }

  async refresh(refreshToken: string) {
    const { data, error } = await this.supabase.anon.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session || !data.user) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
    const account = await this.prisma.userAccount.findUnique({
      where: { id: data.user.id },
      include: { role: true },
    });
    if (!account || !account.isActive) throw new UnauthorizedException('Account is not active');
    return this.toSession(data.session, {
      id: account.id,
      email: account.email,
      role: account.role.name,
      employeeId: account.employeeId,
    });
  }

  async logout(accessToken: string) {
    const { error } = await this.supabase.admin.auth.admin.signOut(accessToken);
    if (error) this.logger.warn(`Supabase signOut failed: ${error.message}`);
    return { loggedOut: true };
  }

  async forgotPassword(email: string) {
    // Always succeed so the endpoint cannot be used to enumerate accounts.
    const { error } = await this.supabase.anon.auth.resetPasswordForEmail(email.toLowerCase());
    if (error) this.logger.warn(`Password reset mail failed: ${error.message}`);
    return { message: 'If the email exists, a reset link has been sent' };
  }

  async changePassword(user: AuthenticatedUser, dto: ChangePasswordDto) {
    const check = await this.supabase.anon.auth.signInWithPassword({
      email: user.email,
      password: dto.currentPassword,
    });
    if (check.error) throw new UnauthorizedException('Current password is incorrect');

    const { error } = await this.supabase.admin.auth.admin.updateUserById(user.id, {
      password: dto.newPassword,
    });
    if (error) throw new BadRequestException(error.message);
    return { message: 'Password updated' };
  }

  async me(user: AuthenticatedUser) {
    const account = await this.prisma.userAccount.findUniqueOrThrow({
      where: { id: user.id },
      include: {
        role: true,
        employee: { include: { department: true, designation: true, defaultBranch: true } },
      },
    });
    return {
      id: account.id,
      email: account.email,
      role: account.role.name,
      lastLoginAt: account.lastLoginAt,
      employee: account.employee,
    };
  }

  private toSession(
    session: { access_token: string; refresh_token: string; expires_in: number; token_type: string },
    user: AuthenticatedUser,
  ) {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      tokenType: 'Bearer',
      expiresIn: session.expires_in,
      user,
    };
  }
}
