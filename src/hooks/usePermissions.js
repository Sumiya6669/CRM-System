import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { OWNER_POWER_FLAGS } from '@/constants/roles';
import {
  getEffectivePermissions,
  hasEffectivePermission,
  hasFullAccess,
  hasOwnerFlag,
  isModuleAllowed,
  isOwner as isOwnerRole,
} from '@/lib/permissions';

export const usePermissions = () => {
  const { role, profile } = useAuth();
  const rawPermissions = profile?.permissions;

  return useMemo(() => {
    const permissions = getEffectivePermissions(role, rawPermissions);
    const strictOwner = isOwnerRole(role);
    const fullAccess = hasFullAccess(role, rawPermissions);

    const can = (permission) => hasEffectivePermission(role, rawPermissions, permission);
    const flag = (name) => hasOwnerFlag(role, rawPermissions, name);

    const canEdit = flag(OWNER_POWER_FLAGS.CAN_EDIT);
    const canDelete = flag(OWNER_POWER_FLAGS.CAN_DELETE);
    const canArchive = flag(OWNER_POWER_FLAGS.CAN_ARCHIVE);
    const canUnlock = flag(OWNER_POWER_FLAGS.CAN_UNLOCK);
    const canViewAudit = flag(OWNER_POWER_FLAGS.CAN_VIEW_AUDIT);

    return {
      role,
      /** Настоящий Owner (роль owner). */
      isStrictOwner: strictOwner,
      /**
       * Owner-полномочия: роль owner либо admin с включённым «Полным доступом».
       * Сохранено имя isOwner для совместимости с существующим кодом.
       */
      isOwner: fullAccess,
      hasFullAccess: fullAccess,
      permissions,
      can,
      canAny: (permissionList) => permissionList.some(can),
      canModule: (moduleKey) => isModuleAllowed(role, rawPermissions, moduleKey),
      canEdit,
      canDelete,
      canArchive,
      canUnlock,
      canViewAudit,
      /** Нужно ли вообще показывать колонку действий в таблицах. */
      canUseRecordActions: canEdit || canDelete || canArchive || canUnlock,
    };
  }, [rawPermissions, role]);
};
