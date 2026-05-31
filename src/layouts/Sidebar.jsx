import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  Calendar,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Dumbbell,
  LayoutDashboard,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PERMISSIONS } from '@/constants/roles';
import { usePermissions } from '@/hooks/usePermissions';

const navItems = [
  { label: 'Дашборд', icon: LayoutDashboard, path: '/', permission: PERMISSIONS.DASHBOARD_READ },
  { label: 'Филиалы', icon: Building2, path: '/branches', permission: PERMISSIONS.DASHBOARD_READ },
  { label: 'Ученики', icon: Users, path: '/students', permission: PERMISSIONS.STUDENTS_READ },
  { label: 'Оплаты', icon: CreditCard, path: '/payments', permission: PERMISSIONS.PAYMENTS_READ },
  { label: 'Склад', icon: Package, path: '/inventory', permission: PERMISSIONS.INVENTORY_READ },
  { label: 'Продажи', icon: ShoppingCart, path: '/sales', permission: PERMISSIONS.SALES_READ },
  { label: 'Посещаемость', icon: CalendarCheck, path: '/attendance', permission: PERMISSIONS.ATTENDANCE_READ },
  { label: 'Расписание', icon: Calendar, path: '/schedule', permission: PERMISSIONS.ATTENDANCE_READ },
  { label: 'Тренеры', icon: Dumbbell, path: '/coaches', permission: PERMISSIONS.STUDENTS_READ },
  { label: 'Отчёты', icon: BarChart3, path: '/reports', permission: PERMISSIONS.REPORTS_READ },
  { label: 'Журнал', icon: ScrollText, path: '/activity-log', permission: PERMISSIONS.AUDIT_LOGS_READ },
  { label: 'Пользователи', icon: ShieldCheck, path: '/users', permission: PERMISSIONS.USERS_MANAGE },
  { label: 'Настройки', icon: Settings, path: '/settings', permission: PERMISSIONS.SETTINGS_READ },
];

export default function Sidebar({ collapsed, mobileOpen, onMobileClose, onToggle }) {
  const location = useLocation();
  const { can } = usePermissions();
  const visibleNavItems = navItems.filter((item) => !item.permission || can(item.permission));

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Закрыть меню"
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] transition-opacity duration-150 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-[100dvh] max-w-[calc(100vw_-_2rem)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200 ease-linear lg:z-40',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          collapsed ? 'w-[240px] lg:w-[68px]' : 'w-[240px]'
        )}
      >
      <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-4">
        <div className={cn('items-center gap-2.5', collapsed ? 'flex lg:hidden' : 'flex')}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">TK</span>
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">TKD Control</span>
          </div>
        {collapsed && (
          <div className="mx-auto hidden h-8 w-8 items-center justify-center rounded-lg bg-primary lg:flex">
            <span className="text-sm font-bold text-primary-foreground">TK</span>
          </div>
        )}
        <button
          type="button"
          aria-label="Закрыть меню"
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:hidden"
          onClick={onMobileClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {visibleNavItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onMobileClose}
              className={cn(
                'flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-all duration-150',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/20 hover:text-sidebar-foreground',
                collapsed && 'lg:justify-center lg:px-2'
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              <span className={cn(collapsed && 'lg:hidden')}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="hidden shrink-0 border-t border-sidebar-border p-2.5 lg:block">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-center rounded-lg py-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/20 hover:text-sidebar-foreground"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
      </aside>
    </>
  );
}
