import {
  Archive,
  Calculator,
  Edit3,
  History,
  LockOpen,
  MoreHorizontal,
  RefreshCcw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const MenuItem = ({ icon: Icon, children, ...props }) => (
  <DropdownMenuItem {...props}>
    <Icon className="mr-2 h-4 w-4" />
    {children}
  </DropdownMenuItem>
);

export default function OwnerActionsMenu({
  onEdit,
  onDelete,
  onRestore,
  onUnlock,
  onArchive,
  onUnarchive,
  onReopen,
  onRepost,
  onRecalculate,
  onViewHistory,
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Owner Actions">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Owner Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {onEdit && <MenuItem icon={Edit3} onSelect={onEdit}>Редактировать</MenuItem>}
        {onRestore && <MenuItem icon={RotateCcw} onSelect={onRestore}>Восстановить</MenuItem>}
        {onUnlock && <MenuItem icon={LockOpen} onSelect={onUnlock}>Разблокировать</MenuItem>}
        {onReopen && <MenuItem icon={RefreshCcw} onSelect={onReopen}>Открыть повторно</MenuItem>}
        {onRepost && <MenuItem icon={RefreshCcw} onSelect={onRepost}>Перепровести</MenuItem>}
        {onArchive && <MenuItem icon={Archive} onSelect={onArchive}>Архивировать</MenuItem>}
        {onUnarchive && <MenuItem icon={RotateCcw} onSelect={onUnarchive}>Вернуть из архива</MenuItem>}
        {onRecalculate && <MenuItem icon={Calculator} onSelect={onRecalculate}>Пересчитать</MenuItem>}
        {onViewHistory && (
          <>
            <DropdownMenuSeparator />
            <MenuItem icon={History} onSelect={onViewHistory}>История изменений</MenuItem>
          </>
        )}
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <MenuItem icon={Trash2} onSelect={onDelete} className="text-red-600 focus:text-red-600">Удалить</MenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
