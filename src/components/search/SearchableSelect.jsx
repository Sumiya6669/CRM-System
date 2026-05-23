import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * SearchableSelect — a live-search dropdown that replaces plain <Select> in modals.
 * Props:
 *   items: [{ value, label, sub? }]
 *   value: string
 *   onChange: (value) => void
 *   placeholder: string
 *   className: string
 */
export default function SearchableSelect({ items = [], value, onChange, placeholder = 'Выберите...', className }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  const selected = items.find(i => i.value === value);

  const filtered = q
    ? items.filter(i => (i.label || '').toLowerCase().includes(q.toLowerCase()) || (i.sub || '').toLowerCase().includes(q.toLowerCase()))
    : items;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && <button type="button" onClick={e => { e.stopPropagation(); onChange(''); setQ(''); }} className="hover:text-foreground text-muted-foreground"><X className="w-3.5 h-3.5" /></button>}
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Поиск..."
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">Не найдено</div>
            )}
            {filtered.map(item => (
              <button
                key={item.value}
                type="button"
                onClick={() => { onChange(item.value); setOpen(false); setQ(''); }}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors",
                  value === item.value && "bg-accent font-medium"
                )}
              >
                <div className="font-medium">{item.label}</div>
                {item.sub && <div className="text-xs text-muted-foreground">{item.sub}</div>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}