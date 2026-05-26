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
  ShoppingCart,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Дашборд', icon: LayoutDashboard, path: '/' },
  { label: 'Филиалы', icon: Building2, path: '/branches' },
  { label: 'Ученики', icon: Users, path: '/students' },
  { label: 'Оплаты', icon: CreditCard, path: '/payments' },
  { label: 'Склад', icon: Package, path: '/inventory' },
  { label: 'Продажи', icon: ShoppingCart, path: '/sales' },
  { label: 'Посещаемость', icon: CalendarCheck, path: '/attendance' },
  { label: 'Расписание', icon: Calendar, path: '/schedule' },
  { label: 'Тренеры', icon: Dumbbell, path: '/coaches' },
  { label: 'Отчёты', icon: BarChart3, path: '/reports' },
  { label: 'Журнал', icon: ScrollText, path: '/activity-log' },
  { label: 'Настройки', icon: Settings, path: '/settings' },
];

export default function Sidebar({ collapsed, mobileOpen, onMobileClose, onToggle }) {
  const location = useLocation();

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
          'fixed left-0 top-0 z-50 flex h-[100dvh] max-w-[calc(100vw_-_2rem)] flex-col border-r border-border bg-card transition-all duration-200 ease-linear lg:z-40',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          collapsed ? 'w-[240px] lg:w-[68px]' : 'w-[240px]'
        )}
      >
      <div className="flex h-16 shrink-0 items-center border-b border-border px-4">
        <div className={cn('items-center gap-2.5', collapsed ? 'flex lg:hidden' : 'flex')}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">TK</span>
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-foreground">TKD Control</span>
          </div>
        {collapsed && (
          <div className="mx-auto hidden h-8 w-8 items-center justify-center rounded-lg bg-primary lg:flex">
            <span className="text-sm font-bold text-primary-foreground">TK</span>
          </div>
        )}
        <button
          type="button"
          aria-label="Закрыть меню"
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground lg:hidden"
          onClick={onMobileClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onMobileClose}
              className={cn(
                'flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-all duration-150',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
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

      <div className="hidden shrink-0 border-t border-border p-2.5 lg:block">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-center rounded-lg py-2 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
      </aside>
    </>
  );
}
