import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { crm } from '@/services/crm';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Topbar from '@/layouts/Topbar';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import PaginationBar from '@/components/ui/PaginationBar';
import { formatMoney, formatDate, PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, ShoppingCart, Search } from 'lucide-react';
import { toast } from 'sonner';
import SaleCartDialog from '@/components/sales/SaleCartDialog';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import DocumentLockBadge from '@/components/ui/DocumentLockBadge';
import { documentService } from '@/services/documentService';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/constants/roles';
import OwnerActionsMenu from '@/components/owner/OwnerActionsMenu';
import OwnerDeleteDialog from '@/components/owner/OwnerDeleteDialog';
import { OWNER_RECORD_TYPES, ownerActionsService } from '@/services/ownerActionsService';

export default function Sales() {
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCartDialog, setShowCartDialog] = useState(false);
  const [form, setForm] = useState({});
  const [editingSale, setEditingSale] = useState(null);
  const [saleToDelete, setSaleToDelete] = useState(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const debouncedSearch = useDebounce(search, 250);
  const { can, isOwner } = usePermissions();

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales'], queryFn: () => crm.entities.Sale.list('-created_date', 500),
  });
  const unlockMutation = useMutation({
    mutationFn: (id) => documentService.unlock('sales', id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      toast.success('Документ разблокирован');
    },
    onError: (error) => toast.error(error.message),
  });
  const ownerDocumentMutation = useMutation({
    mutationFn: ({ id, action, reason }) => ownerActionsService.run(OWNER_RECORD_TYPES.SALE, id, action, reason),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      setSaleToDelete(null);
      toast.success({
        delete: 'Продажа перемещена в корзину',
        unlock: 'Документ разблокирован',
        reopen: 'Документ открыт повторно',
        repost: 'Документ перепроведён',
        recalculate: 'Документ пересчитан',
      }[variables.action] || 'Действие выполнено');
    },
    onError: (error) => toast.error(error.message),
  });
  const { data: products = [] } = useQuery({
    queryKey: ['products'], queryFn: () => crm.entities.Product.list(),
  });
  const { data: students = [] } = useQuery({
    queryKey: ['students'], queryFn: () => crm.entities.Student.list('-created_date', 500),
  });
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'], queryFn: () => crm.entities.Branch.list(),
  });
  const { data: stockItems = [] } = useQuery({
    queryKey: ['stockItems'], queryFn: () => crm.entities.StockItem.list('-created_date', 500),
  });

  const createSaleMutation = useMutation({
    mutationFn: async (data) => {
      if (editingSale) {
        return crm.entities.Sale.update(editingSale.id, {
          buyer_name: data.buyer_name,
          quantity: data.quantity,
          total: data.total,
          payment_method: data.payment_method,
          sale_date: data.sale_date,
          comment: data.comment,
        });
      }
      const product = products.find(p => p.id === data.product_id);
      const student = students.find(s => s.id === data.student_id);
      const branch = branches.find(b => b.id === data.branch_id);
      const total = (product?.sell_price || 0) * (data.quantity || 1);

      // Deduct from stock
      const stockItem = stockItems.find(si => si.product_id === data.product_id && si.branch_id === data.branch_id);
      if (stockItem) {
        await crm.entities.StockItem.update(stockItem.id, { quantity: Math.max(0, (stockItem.quantity || 0) - (data.quantity || 1)) });
      }

      const sale = await crm.entities.Sale.create({
        product_id: data.product_id, product_name: product?.name,
        student_id: data.student_id, student_name: student?.full_name,
        buyer_name: data.buyer_name || student?.full_name,
        branch_id: data.branch_id, branch_name: branch?.name,
        quantity: data.quantity || 1, unit_price: product?.sell_price,
        total, payment_method: data.payment_method,
        sale_date: new Date().toISOString().split('T')[0],
        document_status: 'completed',
      });

      await crm.entities.ActivityLog.create({
        action_type: 'sale_completed',
        description: `Продажа: ${product?.name} × ${data.quantity || 1} — ${formatMoney(total)}`,
        entity_type: 'Sale', entity_id: sale.id,
        branch_id: data.branch_id, branch_name: branch?.name, amount: total,
      });
      return sale;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['stockItems'] });
      setShowAddDialog(false);
      setEditingSale(null);
      setForm({});
      toast.success(editingSale ? 'Продажа обновлена' : 'Продажа оформлена');
    },
    onError: (error) => toast.error(error.message),
  });

  const filtered = useMemo(() => {
    return sales.filter(s => {
      if (branchFilter !== 'all' && s.branch_id !== branchFilter) return false;
      if (debouncedSearch) return (s.product_name || '').toLowerCase().includes(debouncedSearch.toLowerCase()) || (s.student_name || '').toLowerCase().includes(debouncedSearch.toLowerCase());
      return true;
    });
  }, [sales, debouncedSearch, branchFilter]);

  const totalRevenue = filtered.reduce((s, sale) => s + (sale.total || 0), 0);
  const selectedProduct = products.find(p => p.id === form.product_id);
  const pagination = usePagination(filtered, 50);
  const openSaleEditor = (sale) => {
    setEditingSale(sale);
    setForm({
      product_id: sale.product_id,
      branch_id: sale.branch_id,
      buyer_name: sale.buyer_name,
      student_id: sale.student_id,
      quantity: sale.quantity,
      total: sale.total,
      payment_method: sale.payment_method,
      sale_date: sale.sale_date,
      comment: sale.comment,
    });
    setShowAddDialog(true);
  };

  return (
    <div>
      <Topbar title="Продажи" />
      <div className="p-6 max-w-[1400px]">
        <PageHeader title="Продажи товаров" subtitle={`${filtered.length} продаж · Итого: ${formatMoney(totalRevenue)}`}>
          <Button onClick={() => setShowCartDialog(true)} className="gap-1.5 bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Новая продажа
          </Button>
        </PageHeader>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
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
          <EmptyState icon={ShoppingCart} title="Нет продаж" />
        ) : (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <Table className="responsive-card-table">
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-semibold">Дата</TableHead>
                  <TableHead className="text-xs font-semibold">Товар</TableHead>
                  <TableHead className="text-xs font-semibold">Покупатель</TableHead>
                  <TableHead className="text-xs font-semibold">Филиал</TableHead>
                  <TableHead className="text-xs font-semibold">Кол-во</TableHead>
                  <TableHead className="text-xs font-semibold">Сумма</TableHead>
                  <TableHead className="text-xs font-semibold">Способ</TableHead>
                  <TableHead className="text-xs font-semibold">Документ</TableHead>
                  {isOwner && <TableHead className="w-12"><span className="sr-only">Owner Actions</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedItems.map(s => (
                  <TableRow key={s.id} className="hover:bg-muted/20">
                    <TableCell data-label="Дата" className="text-sm">{formatDate(s.sale_date)}</TableCell>
                    <TableCell data-label="Товар" className="text-sm font-medium">{s.product_name}</TableCell>
                    <TableCell data-label="Покупатель" className="text-sm">{s.student_name || s.buyer_name || '—'}</TableCell>
                    <TableCell data-label="Филиал" className="text-sm">{s.branch_name}</TableCell>
                    <TableCell data-label="Кол-во" className="text-sm">{s.quantity}</TableCell>
                    <TableCell data-label="Сумма" className="text-sm font-semibold">{formatMoney(s.total)}</TableCell>
                    <TableCell data-label="Способ" className="text-sm">{PAYMENT_METHOD_LABELS[s.payment_method] || s.payment_method}</TableCell>
                    <TableCell data-label="Документ"><DocumentLockBadge document={s} onUnlock={can(PERMISSIONS.DOCUMENTS_UNLOCK) ? () => unlockMutation.mutate(s.id) : undefined} isUnlocking={unlockMutation.isPending} /></TableCell>
                    {isOwner && (
                      <TableCell data-label="Owner Actions">
                        <OwnerActionsMenu
                          onEdit={() => openSaleEditor(s)}
                          onDelete={() => setSaleToDelete(s)}
                          onUnlock={s.is_locked ? () => ownerDocumentMutation.mutate({ id: s.id, action: 'unlock', reason: 'Разблокировка продажи Owner' }) : undefined}
                          onReopen={() => ownerDocumentMutation.mutate({ id: s.id, action: 'reopen', reason: 'Повторное открытие продажи Owner' })}
                          onRepost={() => ownerDocumentMutation.mutate({ id: s.id, action: 'repost', reason: 'Перепроведение продажи Owner' })}
                          onRecalculate={() => ownerDocumentMutation.mutate({ id: s.id, action: 'recalculate', reason: 'Пересчёт продажи Owner' })}
                          onViewHistory={() => navigate(`/activity-log?entity_type=sales&entity_id=${s.id}`)}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationBar {...pagination} onPrevious={pagination.previousPage} onNext={pagination.nextPage} />
          </div>
        )}
      </div>

      <SaleCartDialog
        open={showCartDialog}
        onClose={() => setShowCartDialog(false)}
        products={products}
        students={students}
        branches={branches}
        stockItems={stockItems}
      />

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingSale ? 'Редактировать продажу' : 'Новая продажа'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Филиал *</Label>
              <Select value={form.branch_id || ''} onValueChange={v => setForm({ ...form, branch_id: v })}>
                <SelectTrigger disabled={Boolean(editingSale)}><SelectValue placeholder="Выберите филиал" /></SelectTrigger>
                <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Товар *</Label>
              <Select value={form.product_id || ''} onValueChange={v => setForm({ ...form, product_id: v })}>
                <SelectTrigger disabled={Boolean(editingSale)}><SelectValue placeholder="Выберите товар" /></SelectTrigger>
                <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {formatMoney(p.sell_price)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ученик (необязательно)</Label>
              <Select value={form.student_id || ''} onValueChange={v => setForm({ ...form, student_id: v })}>
                <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                <SelectContent>{students.filter(s => s.status === 'active').map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Количество *</Label><Input type="number" value={form.quantity || 1} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} min={1} /></div>
              <div className="space-y-1.5">
                <Label className="text-xs">Способ оплаты *</Label>
                <Select value={form.payment_method || ''} onValueChange={v => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>{Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {selectedProduct && (
              <div className="bg-muted/50 rounded-xl p-3 text-sm">
                Итого: <span className="font-bold">{formatMoney(selectedProduct.sell_price * (form.quantity || 1))}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Отмена</Button>
            <Button onClick={() => createSaleMutation.mutate(form)} disabled={!form.product_id || !form.branch_id || !form.payment_method || createSaleMutation.isPending} className="bg-primary hover:bg-primary/90">
              {createSaleMutation.isPending ? 'Сохранение...' : editingSale ? 'Сохранить изменения' : 'Оформить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OwnerDeleteDialog
        open={Boolean(saleToDelete)}
        onOpenChange={(open) => !open && setSaleToDelete(null)}
        title={`Продажа: ${saleToDelete?.product_name || '—'}`}
        details={[`Сумма: ${formatMoney(saleToDelete?.total || 0)}`]}
        isPending={ownerDocumentMutation.isPending}
        onConfirm={(reason) => ownerDocumentMutation.mutate({ id: saleToDelete.id, action: 'delete', reason })}
      />
    </div>
  );
}
