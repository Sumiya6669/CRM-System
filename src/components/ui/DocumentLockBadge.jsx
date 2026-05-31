import { LockKeyhole, UnlockKeyhole } from 'lucide-react';

export default function DocumentLockBadge({ document, onUnlock, isUnlocking = false }) {
  if (!document?.is_locked) {
    return <span className="text-xs text-muted-foreground">Черновик</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-foreground"
        title={`Заблокирован${document.locked_at ? `: ${new Date(document.locked_at).toLocaleString('ru-RU')}` : ''}${document.locked_by ? ` · ${document.locked_by}` : ''}`}
      >
        <LockKeyhole className="h-3 w-3 text-primary" />
        Зафиксирован
      </span>
      {onUnlock && (
        <button type="button" onClick={onUnlock} disabled={isUnlocking} className="text-muted-foreground transition-colors hover:text-foreground" title="Разблокировать документ">
          <UnlockKeyhole className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
}
