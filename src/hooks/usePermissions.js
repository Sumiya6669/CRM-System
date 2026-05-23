import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getRolePermissions, hasPermission, hasAnyPermission } from '@/lib/permissions';

export const usePermissions = () => {
  const { role } = useAuth();

  return useMemo(() => {
    const permissions = getRolePermissions(role);

    return {
      role,
      permissions,
      can: (permission) => hasPermission(role, permission),
      canAny: (permissionList) => hasAnyPermission(role, permissionList),
    };
  }, [role]);
};
