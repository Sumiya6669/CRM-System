import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppProviders } from '@/providers/AppProviders';
import ProtectedRoute from '@/components/ProtectedRoute';
import PermissionRoute from '@/components/auth/PermissionRoute';
import { PERMISSIONS } from '@/constants/roles';
import AppLayout from '@/layouts/AppLayout';
import PageNotFound from '@/pages/PageNotFound';
import LoginPage from '@/pages/auth/LoginPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import ConfigurationRequiredPage from '@/pages/auth/ConfigurationRequiredPage';
import UnauthorizedPage from '@/pages/auth/UnauthorizedPage';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Students = lazy(() => import('@/pages/Students'));
const StudentDetail = lazy(() => import('@/pages/StudentDetail'));
const Branches = lazy(() => import('@/pages/Branches'));
const BranchDetail = lazy(() => import('@/pages/BranchDetail'));
const Payments = lazy(() => import('@/pages/Payments'));
const Inventory = lazy(() => import('@/pages/Inventory'));
const Sales = lazy(() => import('@/pages/Sales'));
const Attendance = lazy(() => import('@/pages/Attendance'));
const Schedule = lazy(() => import('@/pages/Schedule'));
const Coaches = lazy(() => import('@/pages/Coaches'));
const Reports = lazy(() => import('@/pages/Reports'));
const ActivityLogPage = lazy(() => import('@/pages/ActivityLogPage'));
const Settings = lazy(() => import('@/pages/Settings'));
const UserManagement = lazy(() => import('@/pages/UserManagement'));
const RecycleBin = lazy(() => import('@/pages/RecycleBin'));

const withPermission = (element, permissions) => (
  <PermissionRoute permissions={permissions}>{element}</PermissionRoute>
);

const AppLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
        <span className="text-primary-foreground font-bold text-lg">TK</span>
      </div>
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  </div>
);

function AppRoutes() {
  return (
    <Suspense fallback={<AppLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/configuration" element={<ConfigurationRequiredPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={withPermission(<Dashboard />, [PERMISSIONS.DASHBOARD_READ])} />
            <Route path="/students" element={withPermission(<Students />, [PERMISSIONS.STUDENTS_READ])} />
            <Route path="/students/:id" element={withPermission(<StudentDetail />, [PERMISSIONS.STUDENTS_READ])} />
            <Route path="/branches" element={withPermission(<Branches />, [PERMISSIONS.DASHBOARD_READ])} />
            <Route path="/branches/:id" element={withPermission(<BranchDetail />, [PERMISSIONS.DASHBOARD_READ])} />
            <Route path="/payments" element={withPermission(<Payments />, [PERMISSIONS.PAYMENTS_READ])} />
            <Route path="/inventory" element={withPermission(<Inventory />, [PERMISSIONS.INVENTORY_READ])} />
            <Route path="/sales" element={withPermission(<Sales />, [PERMISSIONS.SALES_READ])} />
            <Route path="/attendance" element={withPermission(<Attendance />, [PERMISSIONS.ATTENDANCE_READ])} />
            <Route path="/schedule" element={withPermission(<Schedule />, [PERMISSIONS.ATTENDANCE_READ])} />
            <Route path="/coaches" element={withPermission(<Coaches />, [PERMISSIONS.STUDENTS_READ])} />
            <Route path="/reports" element={withPermission(<Reports />, [PERMISSIONS.REPORTS_READ])} />
            <Route path="/activity-log" element={withPermission(<ActivityLogPage />, [PERMISSIONS.AUDIT_LOGS_READ])} />
            <Route path="/users" element={withPermission(<UserManagement />, [PERMISSIONS.USERS_MANAGE])} />
            <Route path="/trash" element={withPermission(<RecycleBin />, [PERMISSIONS.DOCUMENTS_RESTORE])} />
            <Route path="/settings" element={withPermission(<Settings />, [PERMISSIONS.SETTINGS_READ])} />
          </Route>
        </Route>

        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  );
}
