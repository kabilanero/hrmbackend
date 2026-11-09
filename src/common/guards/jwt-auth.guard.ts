import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Global authentication guard.
 *  1. Extracts the Supabase access token (Authorization: Bearer … or legacy `token` header).
 *  2. Verifies it (locally with the JWT secret, or via Supabase Auth).
 *  3. Loads the application profile + role and attaches it to `request.user`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Missing access token');

    const identity = await this.supabase.verifyAccessToken(token);
    if (!identity) throw new UnauthorizedException('Invalid or expired access token');

    const account = await this.prisma.userAccount.findUnique({
      where: { id: identity.id },
      include: { role: true },
    });
    if (!account) throw new UnauthorizedException('No application profile for this user');
    if (!account.isActive) throw new UnauthorizedException('Account is disabled');

    req.user = {
      id: account.id,
      email: account.email,
      role: account.role.name,
      employeeId: account.employeeId,
    };
    return true;
  }

  private extractToken(req: Request): string | null {
    const raw = (req.headers.authorization ?? (req.headers['token'] as string | undefined)) || '';
    const [scheme, value] = raw.split(' ');
    if (value && /^bearer$/i.test(scheme)) return value;
    return raw && !value ? raw : null;
  }
}
