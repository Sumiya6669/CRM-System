import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PaginationBar({ page, totalPages, totalItems, pageSize, onPrevious, onNext }) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
      <span>
        Показано {start}-{end} из {totalItems}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={onPrevious} disabled={page <= 1}>
          <ChevronLeft className="h-3.5 w-3.5" />
          Назад
        </Button>
        <span className="min-w-16 text-center">
          {page} / {totalPages}
        </span>
        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={onNext} disabled={page >= totalPages}>
          Вперед
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
