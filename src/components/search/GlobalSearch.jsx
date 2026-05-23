import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Clock, Package, Search, User, Users, X } from 'lucide-react';
import { crm } from '@/services/crm';
import { cn } from '@/lib/utils';

const RECENT_KEY = 'tkd_recent_searches';

function getRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecent(query) {
  const prev = getRecent().filter((item) => item !== query).slice(0, 4);
  localStorage.setItem(RECENT_KEY, JSON.stringify([query, ...prev]));
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ students: [], branches: [], products: [] });
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [recent, setRecent] = useState(getRecent);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const search = useCallback(async (value) => {
    if (!value.trim() || value.length < 2) {
      setResults({ students: [], branches: [], products: [] });
      return;
    }

    setLoading(true);

    try {
      const [students, branches, products] = await Promise.all([
        crm.entities.Student.list('-created_date', 500),
        crm.entities.Branch.list(),
        crm.entities.Product.list(),
      ]);
      const q = value.toLowerCase();

      setResults({
        students: students
          .filter((student) =>
            (student.full_name || '').toLowerCase().includes(q) ||
            (student.student_id || '').toLowerCase().includes(q) ||
            (student.parent_phone || '').includes(value) ||
            (student.parent_phone2 || '').includes(value) ||
            (student.coach_name || '').toLowerCase().includes(q) ||
            (student.group_name || '').toLowerCase().includes(q) ||
            (student.branch_name || '').toLowerCase().includes(q)
          )
          .slice(0, 5),
        branches: branches
          .filter((branch) =>
            (branch.name || '').toLowerCase().includes(q) ||
            (branch.city || '').toLowerCase().includes(q) ||
            (branch.address || '').toLowerCase().includes(q)
          )
          .slice(0, 3),
        products: products
          .filter((product) =>
            (product.name || '').toLowerCase().includes(q) ||
            (product.sku || '').toLowerCase().includes(q) ||
            (product.category || '').toLowerCase().includes(q)
          )
          .slice(0, 4),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => search(query), 250);
    return () => window.clearTimeout(timeoutId);
  }, [query, search]);

  const allResults = [
    ...results.students.map((student) => ({ type: 'student', id: student.id, label: student.full_name, path: `/students/${student.id}` })),
    ...results.branches.map((branch) => ({ type: 'branch', id: branch.id, label: branch.name, path: `/branches/${branch.id}` })),
    ...results.products.map((product) => ({ type: 'product', id: product.id, label: product.name, path: '/inventory' })),
  ];

  const handleSelect = (item) => {
    saveRecent(query || item.label);
    setRecent(getRecent());
    navigate(item.path);
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIdx((index) => Math.min(index + 1, allResults.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIdx((index) => Math.max(index - 1, -1));
    }
    if (event.key === 'Enter' && activeIdx >= 0) {
      handleSelect(allResults[activeIdx]);
    }
  };

  const hasResults = allResults.length > 0;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-64 items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Поиск...</span>
        <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIdx(-1);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Поиск учеников, товаров, филиалов..."
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')}>
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
          {loading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />}
        </div>

        <div className="max-h-[400px] overflow-y-auto py-2">
          {!query && recent.length > 0 && (
            <div>
              <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Недавние</div>
              {recent.map((item, index) => (
                <button key={`${item}-${index}`} type="button" onClick={() => setQuery(item)} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-muted/50">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{item}</span>
                </button>
              ))}
            </div>
          )}

          {query && !hasResults && !loading && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Ничего не найдено по «{query}»</div>
          )}

          {hasResults && (
            <div>
              {results.students.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    <Users className="h-3 w-3" /> Ученики
                  </div>
                  {results.students.map((student, index) => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => handleSelect({ path: `/students/${student.id}`, label: student.full_name })}
                      className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50', activeIdx === index && 'bg-muted/50')}
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{student.full_name}</div>
                        <div className="truncate text-xs text-muted-foreground">{student.branch_name}{student.group_name ? ` · ${student.group_name}` : ''}</div>
                      </div>
                      <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}

              {results.branches.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    <Building2 className="h-3 w-3" /> Филиалы
                  </div>
                  {results.branches.map((branch, index) => {
                    const activeIndex = results.students.length + index;
                    return (
                      <button
                        key={branch.id}
                        type="button"
                        onClick={() => handleSelect({ path: `/branches/${branch.id}`, label: branch.name })}
                        className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50', activeIdx === activeIndex && 'bg-muted/50')}
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50">
                          <Building2 className="h-3.5 w-3.5 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{branch.name}</div>
                          <div className="text-xs text-muted-foreground">{branch.city}</div>
                        </div>
                        <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              )}

              {results.products.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    <Package className="h-3 w-3" /> Товары
                  </div>
                  {results.products.map((product, index) => {
                    const activeIndex = results.students.length + results.branches.length + index;
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleSelect({ path: '/inventory', label: product.name })}
                        className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50', activeIdx === activeIndex && 'bg-muted/50')}
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-50">
                          <Package className="h-3.5 w-3.5 text-amber-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{product.name}</div>
                          <div className="text-xs text-muted-foreground">{product.sku || ''}</div>
                        </div>
                        <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span><kbd className="rounded border border-border px-1 font-mono">↑↓</kbd> навигация</span>
          <span><kbd className="rounded border border-border px-1 font-mono">Enter</kbd> открыть</span>
          <span><kbd className="rounded border border-border px-1 font-mono">Esc</kbd> закрыть</span>
        </div>
      </div>
    </div>
  );
}
