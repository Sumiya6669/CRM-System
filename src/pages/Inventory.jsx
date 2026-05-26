import React, { useState, useMemo } from 'react';
import { crm } from '@/services/crm';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Topbar from '@/layouts/Topbar';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import PaginationBar from '@/components/ui/PaginationBar';
import { formatMoney, PRODUCT_CATEGORY_LABELS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Package, Search, ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';
import BulkTransferDialog from '@/components/inventory/BulkTransferDialog';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';

export default function Inventory() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showBulkTransfer, setShowBulkTransfer] = useState(false);
  const [form, setForm] = useState({});
  const [transferForm, setTransferForm] = useState({});
  const qc = useQueryClient();
  const debouncedSearch = useDebounce(search, 250);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'], queryFn: () => crm.entities.Product.list(),
  });
  const { data: stockItems = [] } = useQuery({
    queryKey: ['stockItems'], queryFn: () => crm.entities.StockItem.list('-created_date', 500),
  });
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'], queryFn: () => crm.entities.Branch.list(),
  });

  const createProductMutation = useMutation({
    mutationFn: (data) => crm.entities.Product.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setShowAddProduct(false); setForm({}); toast.success('Товар добавлен'); },
  });

  const transferMutation = useMutation({
    mutationFn: async (data) => {
      const product = products.find(p => p.id === data.product_id);
      const fromBranch = branches.find(b => b.id === data.from_branch_id);
      const toBranch = branches.find(b => b.id === data.to_branch_id);
      // Find or create stock items
      let fromStock = stockItems.find(si => si.product_id === data.product_id && si.branch_id === data.from_branch_id);
      let toStock = stockItems.find(si => si.product_id === data.product_id && si.branch_id === data.to_branch_id);
      
      if (fromStock) await crm.entities.StockItem.update(fromStock.id, { quantity: (fromStock.quantity || 0) - data.quantity });
      if (toStock) {
        await crm.entities.StockItem.update(toStock.id, { quantity: (toStock.quantity || 0) + data.quantity });
      } else {
        await crm.entities.StockItem.create({ product_id: data.product_id, product_name: product?.name, branch_id: data.to_branch_id, branch_name: toBranch?.name, quantity: data.quantity });
      }

      await crm.entities.StockTransfer.create({
        product_id: data.product_id, product_name: product?.name,
        from_branch_id: data.from_branch_id, from_branch_name: fromBranch?.name,
        to_branch_id: data.to_branch_id, to_branch_name: toBranch?.name,
        quantity: data.quantity, reason: data.reason,
        transfer_date: new Date().toISOString().split('T')[0],
      });

      await crm.entities.ActivityLog.create({
        action_type: 'stock_transferred',
        description: `${product?.name} (${data.quantity} шт.) из ${fromBranch?.name} в ${toBranch?.name}`,
        entity_type: 'StockTransfer', branch_name: fromBranch?.name, quantity: data.quantity,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stockItems'] }); setShowTransfer(false); setTransferForm({}); toast.success('Товар перемещён'); },
  });

  const productsWithStock = useMemo(() => {
    return products.map(p => {
      const items = stockItems.filter(si => si.product_id === p.id);
      const totalStock = items.reduce((s, si) => s + (si.quantity || 0), 0);
      const branchStocks = branches.map(b => ({
        branch: b, quantity: items.find(si => si.branch_id === b.id)?.quantity || 0,
      }));
      return { ...p, totalStock, branchStocks, isLow: totalStock <= (p.min_stock || 5) };
    });
  }, [products, stockItems, branches]);

  const filtered = productsWithStock.filter(p => {
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (debouncedSearch) return (p.name || '').toLowerCase().includes(debouncedSearch.toLowerCase()) || (p.sku || '').toLowerCase().includes(debouncedSearch.toLowerCase());
    return true;
  });
  const pagination = usePagination(filtered, 50);

  return (
    <div>
      <Topbar title="Склад" />
      <div className="p-6 max-w-[1400px]">
        <PageHeader title="Склад и товары" subtitle={`${products.length} товаров`}>
          <Button variant="outline" onClick={() => setShowBulkTransfer(true)} className="gap-1.5">
            <ArrowLeftRight className="w-4 h-4" /> Перемещение
          </Button>
          <Button onClick={() => setShowAddProduct(true)} className="gap-1.5 bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Добавить товар
          </Button>
        </PageHeader>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Поиск по названию, артикулу..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="Категория" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все категории</SelectItem>
              {Object.entries(PRODUCT_CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Package} title="Нет товаров" />
        ) : (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <Table className="responsive-card-table">
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-semibold">Артикул</TableHead>
                  <TableHead className="text-xs font-semibold">Название</TableHead>
                  <TableHead className="text-xs font-semibold">Категория</TableHead>
                  <TableHead className="text-xs font-semibold">Размер</TableHead>
                  <TableHead className="text-xs font-semibold">Цена</TableHead>
                  <TableHead className="text-xs font-semibold">Общий остаток</TableHead>
                  {branches.map(b => <TableHead key={b.id} className="text-xs font-semibold">{b.name?.split(' ')[0]}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedItems.map(p => (
                  <TableRow key={p.id} className="hover:bg-muted/20">
                    <TableCell data-label="Артикул" className="text-xs text-muted-foreground font-mono">{p.sku || '—'}</TableCell>
                    <TableCell data-label="Название">
                      <div className="text-sm font-medium">{p.name}</div>
                      {p.color && <div className="text-xs text-muted-foreground">{p.color}</div>}
                    </TableCell>
                    <TableCell data-label="Категория" className="text-sm">{PRODUCT_CATEGORY_LABELS[p.category]}</TableCell>
                    <TableCell data-label="Размер" className="text-sm">{p.size || '—'}</TableCell>
                    <TableCell data-label="Цена" className="text-sm font-medium">{formatMoney(p.sell_price)}</TableCell>
                    <TableCell data-label="Общий остаток">
                      <span className={`text-sm font-semibold ${p.isLow ? 'text-red-600' : ''}`}>{p.totalStock}</span>
                      {p.isLow && <span className="ml-1 text-xs text-red-500">↓</span>}
                    </TableCell>
                    {p.branchStocks.map(bs => (
                      <TableCell key={bs.branch.id} data-label={bs.branch.name || 'Филиал'} className="text-sm">{bs.quantity}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationBar {...pagination} onPrevious={pagination.previousPage} onNext={pagination.nextPage} />
          </div>
        )}
      </div>

      {/* Add product dialog */}
      <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Новый товар</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Название *</Label><Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Артикул</Label><Input value={form.sku || ''} onChange={e => setForm({ ...form, sku: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Категория *</Label>
                <Select value={form.category || ''} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>{Object.entries(PRODUCT_CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Размер</Label><Input value={form.size || ''} onChange={e => setForm({ ...form, size: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Себестоимость</Label><Input type="number" value={form.cost_price || ''} onChange={e => setForm({ ...form, cost_price: Number(e.target.value) })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Цена продажи *</Label><Input type="number" value={form.sell_price || ''} onChange={e => setForm({ ...form, sell_price: Number(e.target.value) })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Мин. остаток</Label><Input type="number" value={form.min_stock || 5} onChange={e => setForm({ ...form, min_stock: Number(e.target.value) })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddProduct(false)}>Отмена</Button>
            <Button onClick={() => createProductMutation.mutate(form)} disabled={!form.name || !form.category || !form.sell_price} className="bg-primary hover:bg-primary/90">Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkTransferDialog
        open={showBulkTransfer}
        onClose={() => setShowBulkTransfer(false)}
        products={products}
        branches={branches}
        stockItems={stockItems}
      />

      {/* Transfer dialog (legacy single) */}
      <Dialog open={showTransfer} onOpenChange={setShowTransfer}>
        <DialogContent>
          <DialogHeader><DialogTitle>Перемещение товара</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Товар *</Label>
              <Select value={transferForm.product_id || ''} onValueChange={v => setTransferForm({ ...transferForm, product_id: v })}>
                <SelectTrigger><SelectValue placeholder="Выберите товар" /></SelectTrigger>
                <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Из филиала *</Label>
                <Select value={transferForm.from_branch_id || ''} onValueChange={v => setTransferForm({ ...transferForm, from_branch_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Откуда" /></SelectTrigger>
                  <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">В филиал *</Label>
                <Select value={transferForm.to_branch_id || ''} onValueChange={v => setTransferForm({ ...transferForm, to_branch_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Куда" /></SelectTrigger>
                  <SelectContent>{branches.filter(b => b.id !== transferForm.from_branch_id).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Количество *</Label><Input type="number" value={transferForm.quantity || ''} onChange={e => setTransferForm({ ...transferForm, quantity: Number(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Причина</Label><Input value={transferForm.reason || ''} onChange={e => setTransferForm({ ...transferForm, reason: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransfer(false)}>Отмена</Button>
            <Button onClick={() => transferMutation.mutate(transferForm)} disabled={!transferForm.product_id || !transferForm.from_branch_id || !transferForm.to_branch_id || !transferForm.quantity} className="bg-primary hover:bg-primary/90">Переместить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
