import React from 'react';
import { Menu, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import GlobalSearch from '@/components/search/GlobalSearch';
import { useLayout } from '@/contexts/LayoutContext';

export default function Topbar({ title }) {
  const navigate = useNavigate();
  const { openMobileSidebar } = useLayout();

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
      </div>
    </header>
  );
}
