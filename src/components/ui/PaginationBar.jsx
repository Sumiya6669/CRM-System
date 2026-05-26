import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PaginationBar({ page, totalPages, totalItems, pageSize, onPrevious, onNext }) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        Показано {start}-{end} из {totalItems}
      </span>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={onPrevious} disabled={page <= 1}>
          <ChevronLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Назад</span>
        </Button>
        <span className="min-w-16 text-center">
          {page} / {totalPages}
        </span>
        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={onNext} disabled={page >= totalPages}>
          <span className="hidden sm:inline">Вперед</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
