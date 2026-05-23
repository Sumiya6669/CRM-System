import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';

export default function PermissionRoute({ permissions = [], children }) {
  const { canAny } = usePermissions();

  if (!permissions.length || canAny(permissions)) {
    return children;
  }

  return <Navigate to="/unauthorized" replace />;
}
