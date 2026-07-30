import {
  ADMIN_FULL_ACCESS_PERMISSIONS,
  FLAG_PERMISSIONS,
  MODULE_KEYS,
  OWNER_POWER_FLAGS,
  PERMISSION_RESOURCE_ALIASES,
  ROLES,
  ROLE_PERMISSIONS,
} from '@/constants/roles';

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

const readFlag = (permissions, flag) => permissions?.[flag] === true;

/**
 * Полные owner-полномочия: настоящий Owner либо администратор,
 * которому Owner включил флаг full_access.
 */
export const hasFullAccess = (role, permissions) => {
  if (isOwner(role)) {
    return true;
  }
  return normalizeRole(role) === ROLES.ADMIN && readFlag(permissions, OWNER_POWER_FLAGS.FULL_ACCESS);
};

/** Проверка отдельного owner-полномочия (full_access включает все). */
export const hasOwnerFlag = (role, permissions, flag) => {
  if (hasFullAccess(role, permissions)) {
    return true;
  }
  return normalizeRole(role) === ROLES.ADMIN && readFlag(permissions, flag);
};

/** Модуль включён, если Owner не выключил его явно. */
export const isModuleAllowed = (role, permissions, moduleKey) => {
  if (isOwner(role)) {
    return true;
  }
  return permissions?.[moduleKey] !== false;
};

const resolveModuleKey = (permission) => {
  const prefix = String(permission).split(':')[0];
  const mapped = PERMISSION_RESOURCE_ALIASES[prefix] || prefix;
  return MODULE_KEYS.includes(mapped) ? mapped : null;
};

/**
 * Итоговый набор прав: базовые права роли + расширения,
 * выданные Owner через profiles.permissions.
 */
export const getEffectivePermissions = (role, permissions) => {
  const base = new Set(getRolePermissions(role));

  if (isOwner(role)) {
    return Array.from(base);
  }

  if (normalizeRole(role) !== ROLES.ADMIN) {
    return Array.from(base);
  }

  if (readFlag(permissions, OWNER_POWER_FLAGS.FULL_ACCESS)) {
    ADMIN_FULL_ACCESS_PERMISSIONS.forEach((permission) => base.add(permission));
    return Array.from(base);
  }

  Object.entries(FLAG_PERMISSIONS).forEach(([flag, granted]) => {
    if (readFlag(permissions, flag)) {
      granted.forEach((permission) => base.add(permission));
    }
  });

  return Array.from(base);
};

export const hasEffectivePermission = (role, permissions, permission) => {
  if (!getEffectivePermissions(role, permissions).includes(permission)) {
    return false;
  }

  const moduleKey = resolveModuleKey(permission);
  if (!moduleKey) {
    return true;
  }

  return isModuleAllowed(role, permissions, moduleKey);
};

export const hasAnyPermission = (role, permissions = []) => {
  return permissions.some((permission) => hasPermission(role, permission));
};

export const canAccessRoute = (role, routePermissions = []) => {
  if (!routePermissions.length) {
    return true;
  }

  return hasAnyPermission(role, routePermissions);
};
