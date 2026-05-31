import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function OwnerDeleteDialog({
  open,
  onOpenChange,
  title,
  details = [],
  onConfirm,
  isPending = false,
  permanent = false,
}) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) setReason('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{permanent ? 'Удалить безвозвратно?' : 'Удалить запись?'}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Это действие влияет на учет и исторические данные.
            </div>
            <div>{permanent ? 'Запись будет удалена без возможности восстановления.' : 'Запись будет перемещена в корзину и скрыта от стандартных пользователей.'}</div>
          </div>
          <div className="space-y-1 text-sm">
            <div className="font-semibold">{title}</div>
            {details.map((detail) => <div key={detail} className="text-muted-foreground">{detail}</div>)}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Причина *</Label>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Укажите причину действия" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button
            variant="destructive"
            disabled={!reason.trim() || isPending}
            onClick={() => onConfirm(reason.trim())}
          >
            {isPending ? 'Удаление...' : permanent ? 'Удалить безвозвратно' : 'Подтвердить удаление'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
