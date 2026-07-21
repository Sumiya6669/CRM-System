import React from 'react';
import { LogOut, Menu, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import GlobalSearch from '@/components/search/GlobalSearch';
import { useLayout } from '@/contexts/LayoutContext';
import { useAuth } from '@/contexts/AuthContext';

export default function Topbar({ title }) {
  const navigate = useNavigate();
  const { openMobileSidebar } = useLayout();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const initial = (user?.full_name || user?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-[calc(4rem_+_env(safe-area-inset-top))] items-center justify-between gap-3 border-b border-border bg-card/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-ml-2 h-10 w-10 shrink-0 lg:hidden"
          onClick={openMobileSidebar}
          aria-label="Открыть меню"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">{title}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <GlobalSearch />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-10 gap-1.5 bg-primary px-3 hover:bg-primary/90 sm:h-9">
              <Plus className="h-4 w-4" />
              <span className="hidden text-sm sm:inline">Добавить</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => navigate('/students?action=add')}>Нового ученика</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/payments?action=add')}>Принять оплату</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/sales?action=add')}>Продажу товара</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/attendance?action=add')}>Отметить посещение</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full bg-accent text-sm font-semibold text-accent-foreground sm:h-9 sm:w-9"
              aria-label="Аккаунт"
            >
              {initial || '?'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <div className="truncate text-sm font-medium">{user?.full_name || 'Пользователь'}</div>
              <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="gap-2 text-red-600 focus:text-red-600">
              <LogOut className="h-4 w-4" />
              Выйти из аккаунта
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
