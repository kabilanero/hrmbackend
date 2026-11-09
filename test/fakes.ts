import { randomUUID } from 'crypto';

/** In-memory stand-in for SupabaseService: tokens look like `fake.<userId>`. */
export class FakeSupabaseService {
  users = new Map<string, { id: string; email: string; password: string }>();

  admin = {
    auth: {
      admin: {
        createUser: async ({ email, password }: { email: string; password: string }) => {
          const user = { id: randomUUID(), email, password };
          this.users.set(user.id, user);
          return { data: { user }, error: null };
        },
        deleteUser: async (id: string) => {
          this.users.delete(id);
          return { error: null };
        },
        updateUserById: async (id: string, attrs: { password?: string }) => {
          const u = this.users.get(id);
          if (u && attrs.password) u.password = attrs.password;
          return { error: null };
        },
        signOut: async () => ({ error: null }),
      },
    },
  };

  anon = {
    auth: {
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        const u = [...this.users.values()].find((x) => x.email === email && x.password === password);
        if (!u) return { data: { session: null, user: null }, error: { message: 'Invalid login credentials' } };
        return {
          data: {
            user: { id: u.id },
            session: { access_token: `fake.${u.id}`, refresh_token: `refresh.${u.id}`, expires_in: 3600, token_type: 'bearer' },
          },
          error: null,
        };
      },
      refreshSession: async ({ refresh_token }: { refresh_token: string }) => {
        const id = refresh_token.replace('refresh.', '');
        return this.users.has(id)
          ? {
              data: {
                user: { id },
                session: { access_token: `fake.${id}`, refresh_token, expires_in: 3600, token_type: 'bearer' },
              },
              error: null,
            }
          : { data: { session: null, user: null }, error: { message: 'bad refresh' } };
      },
      resetPasswordForEmail: async () => ({ error: null }),
    },
  };

  async verifyAccessToken(token: string) {
    if (!token.startsWith('fake.')) return null;
    const id = token.slice(5);
    return { id, email: this.users.get(id)?.email ?? '' };
  }

  /** test helper: register a supabase user and return its bearer token */
  addUser(email: string, password = 'Passw0rdOK') {
    const id = randomUUID();
    this.users.set(id, { id, email, password });
    return { id, token: `fake.${id}` };
  }
}

export class FakeStorageService {
  files = new Map<string, Buffer>();
  async upload(path: string, body: Buffer) {
    this.files.set(path, body);
    return path;
  }
  async signedUrl(path: string) {
    return `https://signed.example/${path}`;
  }
  async remove(path: string) {
    this.files.delete(path);
  }
}
