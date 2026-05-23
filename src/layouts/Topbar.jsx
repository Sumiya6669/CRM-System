import React from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import GlobalSearch from '@/components/search/GlobalSearch';

export default function Topbar({ title }) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur-md">
      <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>

      <div className="flex items-center gap-3">
        <GlobalSearch />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-9 gap-1.5 bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              <span className="text-sm">Добавить</span>
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
