import { SetMetadata } from '@nestjs/common';
import { RoleName } from '../constants/roles.constant';

export const ROLES_KEY = 'roles';
/** Restricts a route / controller to the given roles (any-of). */
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);
