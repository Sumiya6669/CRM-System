import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { crm } from '@/services/crm';
import { useQuery } from '@tanstack/react-query';
import Topbar from '@/layouts/Topbar';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import PaginationBar from '@/components/ui/PaginationBar';
import { formatDate, formatMoney, ACTION_TYPE_LABELS } from '@/lib/constants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollText } from 'lucide-react';
import { usePagination } from '@/hooks/usePagination';

export default function ActivityLogPage() {
  const [typeFilter, setTypeFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [searchParams] = useSearchParams();
  const entityType = searchParams.get('entity_type');
  const entityId = searchParams.get('entity_id');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['activityLogs'], queryFn: () => crm.entities.ActivityLog.list('-created_date', 500),
  });
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => crm.entities.Branch.list() });

  const filtered = logs.filter(l => {
    if (typeFilter !== 'all' && l.action_type !== typeFilter) return false;
    if (branchFilter !== 'all' && l.branch_id !== branchFilter) return false;
    if (entityType && l.entity_type !== entityType) return false;
    if (entityId && l.entity_id !== entityId) return false;
    return true;
  });
  const pagination = usePagination(filtered, 100);

  return (
    <div>
      <Topbar title="Журнал действий" />
      <div className="p-6 max-w-[1400px]">
        <PageHeader title="Журнал действий" subtitle={`${filtered.length} записей`} />

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-52 h-9 text-sm"><SelectValue placeholder="Тип действия" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все типы</SelectItem>
              {Object.entries(ACTION_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="Филиал" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все филиалы</SelectItem>
              {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={ScrollText} title="Нет записей" />
        ) : (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <Table className="responsive-card-table">
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-semibold">Дата</TableHead>
                  <TableHead className="text-xs font-semibold">Тип</TableHead>
                  <TableHead className="text-xs font-semibold">Описание</TableHead>
                  <TableHead className="text-xs font-semibold">Филиал</TableHead>
                  <TableHead className="text-xs font-semibold">Сумма/Кол-во</TableHead>
                  <TableHead className="text-xs font-semibold">Пользователь</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedItems.map(l => (
                  <TableRow key={l.id} className="hover:bg-muted/20">
                    <TableCell data-label="Дата" className="text-sm">{formatDate(l.created_date)}</TableCell>
                    <TableCell data-label="Тип">
                      <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                        {ACTION_TYPE_LABELS[l.action_type] || l.action_type}
                      </span>
                    </TableCell>
                    <TableCell data-label="Описание" className="text-sm whitespace-normal">{l.description}</TableCell>
                    <TableCell data-label="Филиал" className="text-sm">{l.branch_name || '—'}</TableCell>
                    <TableCell data-label="Сумма/Кол-во" className="text-sm font-medium">
                      {l.amount ? formatMoney(l.amount) : l.quantity ? `${l.quantity} шт.` : '—'}
                    </TableCell>
                    <TableCell data-label="Пользователь" className="text-sm text-muted-foreground">{l.user_name || l.created_by || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationBar {...pagination} onPrevious={pagination.previousPage} onNext={pagination.nextPage} />
          </div>
        )}
      </div>
    </div>
  );
}
