import React, { useState, useMemo } from 'react';
import { crm } from '@/services/crm';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Topbar from '@/layouts/Topbar';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import PaginationBar from '@/components/ui/PaginationBar';
import { formatMoney, formatDate, PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, CreditCard, Search } from 'lucide-react';
import { toast } from 'sonner';
import SearchableSelect from '@/components/search/SearchableSelect';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';

export default function Payments() {
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [form, setForm] = useState({});
  const qc = useQueryClient();
  const debouncedSearch = useDebounce(search, 250);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: () => crm.entities.Payment.list('-payment_date', 500),
  });
  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => crm.entities.Student.list('-created_date', 500),
  });
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => crm.entities.Branch.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const student = students.find(s => s.id === data.student_id);
      const branch = branches.find(b => b.id === (data.branch_id || student?.branch_id));
      const payment = await crm.entities.Payment.create({
        ...data,
        student_name: student?.full_name,
        branch_id: data.branch_id || student?.branch_id,
        branch_name: branch?.name,
        payment_date: data.payment_date || new Date().toISOString().split('T')[0],
        confirmed: true,
      });
      await crm.entities.ActivityLog.create({
        action_type: 'payment_received',
        description: `Оплата ${formatMoney(data.amount)} от ${student?.full_name}`,
        entity_type: 'Payment', entity_id: payment.id,
        branch_id: branch?.id, branch_name: branch?.name,
        amount: data.amount,
      });
      return payment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      setShowAddDialog(false);
      setForm({});
      toast.success('Оплата принята');
    },
  });

  const filtered = useMemo(() => {
    return payments.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (branchFilter !== 'all' && p.branch_id !== branchFilter) return false;
      if (methodFilter !== 'all' && p.payment_method !== methodFilter) return false;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        return (p.student_name || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [payments, debouncedSearch, branchFilter, statusFilter, methodFilter]);

  const totalFiltered = filtered.filter(p => p.status !== 'cancelled').reduce((s, p) => s + (p.amount || 0), 0);
  const pagination = usePagination(filtered, 50);

  return (
    <div>
      <Topbar title="Оплаты" />
      <div className="p-6 max-w-[1400px]">
        <PageHeader title="Управление оплатами" subtitle={`${filtered.length} записей · Итого: ${formatMoney(totalFiltered)}`}>
          <Button onClick={() => setShowAddDialog(true)} className="gap-1.5 bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Принять оплату
          </Button>
        </PageHeader>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Поиск по имени ученика..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="Филиал" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все филиалы</SelectItem>
              {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="Статус" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="Способ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все способы</SelectItem>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={CreditCard} title="Нет оплат" />
        ) : (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-semibold">Ученик</TableHead>
                  <TableHead className="text-xs font-semibold">Филиал</TableHead>
                  <TableHead className="text-xs font-semibold">Сумма</TableHead>
                  <TableHead className="text-xs font-semibold">Период</TableHead>
                  <TableHead className="text-xs font-semibold">Способ</TableHead>
                  <TableHead className="text-xs font-semibold">Дата</TableHead>
                  <TableHead className="text-xs font-semibold">Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedItems.map(p => (
                  <TableRow key={p.id} className="hover:bg-muted/20">
                    <TableCell className="text-sm font-medium">{p.student_name}</TableCell>
                    <TableCell className="text-sm">{p.branch_name}</TableCell>
                    <TableCell className="text-sm font-semibold">{formatMoney(p.amount)}</TableCell>
                    <TableCell className="text-sm">{p.period || '—'}</TableCell>
                    <TableCell className="text-sm">{PAYMENT_METHOD_LABELS[p.payment_method] || p.payment_method}</TableCell>
                    <TableCell className="text-sm">{formatDate(p.payment_date)}</TableCell>
                    <TableCell><StatusBadge status={p.status} label={PAYMENT_STATUS_LABELS[p.status]} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationBar {...pagination} onPrevious={pagination.previousPage} onNext={pagination.nextPage} />
          </div>
        )}
      </div>

      {/* Add dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Принять оплату</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Ученик *</Label>
              <SearchableSelect
                value={form.student_id || ''}
                onChange={v => setForm({ ...form, student_id: v })}
                placeholder="Поиск ученика..."
                items={students.filter(s => s.status === 'active').map(s => ({
                  value: s.id,
                  label: s.full_name,
                  sub: `${s.branch_name}${s.parent_phone ? ' · ' + s.parent_phone : ''}`,
                }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Сумма *</Label>
                <Input type="number" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} placeholder="25 000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Период</Label>
                <Input type="month" value={form.period || ''} onChange={e => setForm({ ...form, period: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Способ оплаты *</Label>
                <Select value={form.payment_method || ''} onValueChange={v => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Статус</Label>
                <Select value={form.status || 'paid'} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Дата оплаты</Label>
              <Input type="date" value={form.payment_date || ''} onChange={e => setForm({ ...form, payment_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Комментарий</Label>
              <Textarea value={form.comment || ''} onChange={e => setForm({ ...form, comment: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Отмена</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={!form.student_id || !form.amount || !form.payment_method || createMutation.isPending} className="bg-primary hover:bg-primary/90">
              {createMutation.isPending ? 'Сохранение...' : 'Подтвердить оплату'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
