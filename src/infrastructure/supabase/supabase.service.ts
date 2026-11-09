import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppConfig } from '../../config/configuration';

export interface VerifiedIdentity {
  id: string;
  email: string;
}

/**
 * Owns the two Supabase clients:
 *  - `admin` : service-role key, server-side only (user management, storage)
 *  - `anon`  : public key, used for password sign-in / token refresh
 * Both are stateless (no session persistence) because this is a server.
 */
@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  readonly admin: SupabaseClient;
  readonly anon: SupabaseClient;
  private readonly jwtSecret?: string;

  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly jwt: JwtService,
  ) {
    const { url, anonKey, serviceRoleKey, jwtSecret } = config.get('supabase', { infer: true });
    const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
    this.admin = createClient(url, serviceRoleKey, opts);
    this.anon = createClient(url, anonKey, opts);
    this.jwtSecret = jwtSecret;
  }

  /**
   * Verifies a Supabase access token.
   * With SUPABASE_JWT_SECRET it is verified locally (no network hop); otherwise
   * Supabase Auth is asked (works for asymmetric-key projects too).
   */
  async verifyAccessToken(token: string): Promise<VerifiedIdentity | null> {
    // Local verification is only possible for legacy HS256 tokens. Projects using
    // asymmetric signing keys (ES256/RS256) are verified by Supabase Auth instead.
    if (this.jwtSecret && this.tokenAlgorithm(token) === 'HS256') {
      try {
        const payload = await this.jwt.verifyAsync<{ sub: string; email?: string }>(token, {
          secret: this.jwtSecret,
          algorithms: ['HS256'],
        });
        return payload.sub ? { id: payload.sub, email: payload.email ?? '' } : null;
      } catch {
        return null;
      }
    }
    const { data, error } = await this.admin.auth.getUser(token);
    if (error || !data.user) {
      if (error) this.logger.debug(`Token rejected by Supabase: ${error.message}`);
      return null;
    }
    return { id: data.user.id, email: data.user.email ?? '' };
  }

  private tokenAlgorithm(token: string): string | undefined {
    try {
      return JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString()).alg;
    } catch {
      return undefined;
    }
  }
}