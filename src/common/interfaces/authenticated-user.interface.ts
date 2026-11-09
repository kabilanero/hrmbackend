export interface AuthenticatedUser {
  /** Supabase auth user id (== user_accounts.id) */
  id: string;
  email: string;
  role: string;
  employeeId: string | null;
}
