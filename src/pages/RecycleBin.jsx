import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Topbar from '@/layouts/Topbar';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import PaginationBar from '@/components/ui/PaginationBar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import OwnerActionsMenu from '@/components/owner/OwnerActionsMenu';
import OwnerDeleteDialog from '@/components/owner/OwnerDeleteDialog';
import { ownerActionsService } from '@/services/ownerActionsService';
import { crm } from '@/services/crm';
import { formatDate } from '@/lib/constants';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';

const TYPE_LABELS = {
  inventory: 'Товар',
  payments: 'Оплата',
  sales: 'Продажа',
  inventory_movements: 'Перемещение',
  inventory_receipts: 'Поступление',
  stock_adjustments: 'Корректировка',
  students: 'Ученик',
  attendance: 'Посещаемость',
  subscriptions: 'Абонемент',
  student_transfers: 'Перевод ученика',
};

export default function RecycleBin() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [recordToDelete, setRecordToDelete] = useState(null);
  const debouncedSearch = useDebounce(search, 250);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['deletedRecords'],
    queryFn: () => ownerActionsService.listDeletedRecords(),
  });
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => crm.entities.Branch.list(),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['deletedRecords'] });
    qc.invalidateQueries({ queryKey: ['products'] });
    qc.invalidateQueries({ queryKey: ['students'] });
    qc.invalidateQueries({ queryKey: ['payments'] });
    qc.invalidateQueries({ queryKey: ['sales'] });
  };

  const restoreMutation = useMutation({
    mutationFn: (record) => ownerActionsService.restore(record.record_type, record.record_id, 'Восстановление записи Owner из корзины'),
    onSuccess: () => {
      refresh();
      toast.success('Запись восстановлена');
    },
    onError: (error) => toast.error(error.message),
  });
  const purgeMutation = useMutation({
    mutationFn: ({ record, reason }) => ownerActionsService.permanentDelete(record.record_type, record.record_id, reason),
    onSuccess: () => {
      refresh();
      setRecordToDelete(null);
      toast.success('Запись удалена безвозвратно');
    },
    onError: (error) => toast.error(error.message),
  });

  const users = useMemo(() => {
    const uniqueUsers = new Map();
    records.forEach((record) => {
      if (record.deleted_by) uniqueUsers.set(record.deleted_by, record.deleted_by_name || record.deleted_by);
    });
    return [...uniqueUsers.entries()];
  }, [records]);

  const filtered = useMemo(() => records.filter((record) => {
    if (typeFilter !== 'all' && record.record_type !== typeFilter) return false;
    if (branchFilter !== 'all' && record.branch_id !== branchFilter) return false;
    if (userFilter !== 'all' && record.deleted_by !== userFilter) return false;
    if (dateFilter && !record.deleted_at?.startsWith(dateFilter)) return false;
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      return (record.label || '').toLowerCase().includes(query)
        || (record.snapshot?.sku || '').toLowerCase().includes(query);
    }
    return true;
  }), [records, typeFilter, branchFilter, userFilter, dateFilter, debouncedSearch]);
  const pagination = usePagination(filtered, 50);

  return (
    <div>
      <Topbar title="Корзина" />
      <div className="p-6 max-w-[1400px]">
        <PageHeader title="Удалённые записи" subtitle={`${filtered.length} записей`} />

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] max-w-[300px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск..." className="h-9 pl-9 text-sm" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-48 text-sm"><SelectValue placeholder="Тип записи" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все типы</SelectItem>
              {Object.entries(TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="h-9 w-44 text-sm"><SelectValue placeholder="Филиал" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все филиалы</SelectItem>
              {branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="h-9 w-44 text-sm"><SelectValue placeholder="Пользователь" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все пользователи</SelectItem>
              {users.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="h-9 w-40 text-sm" />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Trash2} title="Корзина пуста" />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Table className="responsive-card-table">
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-semibold">Тип</TableHead>
                  <TableHead className="text-xs font-semibold">Запись</TableHead>
                  <TableHead className="text-xs font-semibold">Филиал</TableHead>
                  <TableHead className="text-xs font-semibold">Удалено</TableHead>
                  <TableHead className="text-xs font-semibold">Пользователь</TableHead>
                  <TableHead className="w-12"><span className="sr-only">Owner Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedItems.map((record) => (
                  <TableRow key={`${record.record_type}-${record.record_id}`} className="hover:bg-muted/20">
                    <TableCell data-label="Тип" className="text-sm">{TYPE_LABELS[record.record_type] || record.record_type}</TableCell>
                    <TableCell data-label="Запись" className="text-sm font-medium">{record.label}</TableCell>
                    <TableCell data-label="Филиал" className="text-sm">{record.branch_name || '—'}</TableCell>
                    <TableCell data-label="Удалено" className="text-sm">{formatDate(record.deleted_at)}</TableCell>
                    <TableCell data-label="Пользователь" className="text-sm">{record.deleted_by_name || '—'}</TableCell>
                    <TableCell data-label="Owner Actions">
                      <OwnerActionsMenu
                        onRestore={() => restoreMutation.mutate(record)}
                        onViewHistory={() => navigate(`/activity-log?entity_type=${record.record_type}&entity_id=${record.record_id}`)}
                        onDelete={() => setRecordToDelete(record)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationBar {...pagination} onPrevious={pagination.previousPage} onNext={pagination.nextPage} />
          </div>
        )}
      </div>

      <OwnerDeleteDialog
        open={Boolean(recordToDelete)}
        onOpenChange={(open) => !open && setRecordToDelete(null)}
        title={recordToDelete?.label || 'Запись'}
        details={[`Тип: ${TYPE_LABELS[recordToDelete?.record_type] || recordToDelete?.record_type || '—'}`]}
        permanent
        isPending={purgeMutation.isPending}
        onConfirm={(reason) => purgeMutation.mutate({ record: recordToDelete, reason })}
      />
    </div>
  );
}
