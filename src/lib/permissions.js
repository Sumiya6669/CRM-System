import { ROLE_PERMISSIONS, ROLES } from '@/constants/roles';

export const normalizeRole = (role) => {
  return Object.values(ROLES).includes(role) ? role : ROLES.TRAINER;
};

export const getRolePermissions = (role) => {
  return ROLE_PERMISSIONS[normalizeRole(role)] || [];
};

export const hasPermission = (role, permission) => {
  return getRolePermissions(role).includes(permission);
};

export const isOwner = (role) => normalizeRole(role) === ROLES.OWNER;

export const hasAnyPermission = (role, permissions = []) => {
  return permissions.some((permission) => hasPermission(role, permission));
};

export const canAccessRoute = (role, routePermissions = []) => {
  if (!routePermissions.length) {
    return true;
  }

  return hasAnyPermission(role, routePermissions);
};
