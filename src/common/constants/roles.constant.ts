export enum RoleName {
  ADMIN = 'ADMIN',
  HR = 'HR',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
}

/** Roles that can see and manage other people's HR data. */
export const PRIVILEGED_ROLES: RoleName[] = [RoleName.ADMIN, RoleName.HR, RoleName.MANAGER];
