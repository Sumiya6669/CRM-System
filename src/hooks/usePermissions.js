import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getRolePermissions, hasPermission, isOwner } from '@/lib/permissions';

export const usePermissions = () => {
  const { role, profile } = useAuth();

  return useMemo(() => {
    const permissions = getRolePermissions(role);
    const owner = isOwner(role);

    const can = (permission) => {
      const resource = permission.split(':')[0];
      return hasPermission(role, permission) && (owner || profile?.permissions?.[resource] !== false);
    };

    return {
      role,
      isOwner: owner,
      permissions,
      can,
      canAny: (permissionList) => permissionList.some(can),
    };
  }, [profile?.permissions, role]);
};
