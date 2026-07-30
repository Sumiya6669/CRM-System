import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Plus, Package, Search, ArrowLeftRight, Boxes } from 'lucide-react';
import { toast } from 'sonner';
import BulkTransferDialog from '@/components/inventory/BulkTransferDialog';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/constants/roles';
import OwnerActionsMenu from '@/components/owner/OwnerActionsMenu';
import OwnerDeleteDialog from '@/components/owner/OwnerDeleteDialog';
import { OWNER_RECORD_TYPES, ownerActionsService } from '@/services/ownerActionsService';

const emptyForm = { name: '', sku: '', category: '', size: '', cost_price: 0, sell_price: 0, min_stock: 0 };

export default function Inventory() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showBulkTransfer, setShowBulkTransfer] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [stockForm, setStockForm] = useState({});
  const [editingProduct, setEditingProduct] = useState(null);
  const [productToDelete, setProductToDelete] = useState(null);
  const [stockProduct, setStockProduct] = useState(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { can, canEdit, canDelete, canArchive } = usePermissions();
  const debouncedSearch = useDebounce(search, 250);

  const canWriteInventory = can(PERMISSIONS.INVENTORY_WRITE);
  const canEditProduct = canWriteInventory || canEdit;
  const showRecordActions = canEditProduct || canDelete || canArchive;
  const showArchived = canArchive || canDelete;

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', { includeArchived: showArchived }],
    queryFn: () => crm.entities.Product.list(undefined, undefined, { includeArchived: showArchived }),
  });
  const { data: stockItems = [] } = useQuery({
    queryKey: ['stockItems'], queryFn: () => crm.entities.StockItem.list('-created_date', 1000),
  });
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'], queryFn: () => crm.entities.Branch.list(),
  });

  /** Записывает остатки по филиалам: обновляет существующие строки, создаёт недостающие. */
  const persistStock = async (product, quantities) => {
    const entries = Object.entries(quantities || {});
    for (const [branchId, rawQuantity] of entries) {
      const quantity = Math.max(0, Number(rawQuantity) || 0);
      const branch = branches.find(b => b.id === branchId);
      const existing = stockItems.find(si => si.product_id === product.id && si.branch_id === branchId);

      if (existing) {
        if ((existing.quantity || 0) !== quantity) {
          await crm.entities.StockItem.update(existing.id, {
            quantity,
            product_name: product.name,
            branch_name: branch?.name,
          });
        }
      } else if (quantity > 0) {
        await crm.entities.StockItem.create({
          product_id: product.id,
          product_name: product.name,
          branch_id: branchId,
          branch_name: branch?.name,
          quantity,
        });
      }
    }
  };

  const saveProductMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        name: data.name,
        sku: data.sku || null,
        category: data.category,
        size: data.size || null,
        cost_price: Number(data.cost_price) || 0,
        sell_price: Number(data.sell_price) || 0,
        min_stock: Math.max(0, Number(data.min_stock) || 0),
      };
      const product = editingProduct
        ? await crm.entities.Product.update(editingProduct.id, payload)
        : await crm.entities.Product.create({ ...payload, status: 'active' });

      await persistStock(product, stockForm);
      return product;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['stockItems'] });
      setShowAddProduct(false);
      setEditingProduct(null);
      setForm(emptyForm);
      setStockForm({});
      toast.success(editingProduct ? 'Товар обновлён' : 'Товар добавлен');
    },
    onError: (error) => toast.error(error.message),
  });

  const stockOnlyMutation = useMutation({
    mutationFn: async () => persistStock(stockProduct, stockForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stockItems'] });
      setStockProduct(null);
      setStockForm({});
      toast.success('Остатки обновлены');
    },
    onError: (error) => toast.error(error.message),
  });

  const ownerProductMutation = useMutation({
    mutationFn: ({ id, action, reason }) => ownerActionsService.run(OWNER_RECORD_TYPES.PRODUCT, id, action, reason),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['products'] });
      setProductToDelete(null);
      toast.success({
        archive: 'Товар архивирован',
        unarchive: 'Товар возвращён из архива',
        delete: 'Товар перемещён в корзину',
      }[variables.action] || 'Действие выполнено');
    },
    onError: (error) => toast.error(error.message),
  });

  const productsWithStock = useMemo(() => {
    return products.map(p => {
      const items = stockItems.filter(si => si.product_id === p.id);
      const totalStock = items.reduce((s, si) => s + (si.quantity || 0), 0);
      const branchStocks = branches.map(b => ({
        branch: b, quantity: items.find(si => si.branch_id === b.id)?.quantity || 0,
      }));
      return { ...p, totalStock, branchStocks, isLow: totalStock <= (p.min_stock ?? 0) };
    });
  }, [products, stockItems, branches]);

  const filtered = productsWithStock.filter(p => {
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (debouncedSearch) return (p.name || '').toLowerCase().includes(debouncedSearch.toLowerCase()) || (p.sku || '').toLowerCase().includes(debouncedSearch.toLowerCase());
    return true;
  });
  const pagination = usePagination(filtered, 50);
  const activeProducts = products.filter((product) => !product.is_archived);

  const buildStockForm = (productId) => {
    return branches.reduce((result, branch) => {
      const item = stockItems.find(si => si.product_id === productId && si.branch_id === branch.id);
      result[branch.id] = item?.quantity ?? 0;
      return result;
    }, {});
  };

  const openNewProduct = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setStockForm(branches.reduce((result, branch) => ({ ...result, [branch.id]: 0 }), {}));
    setShowAddProduct(true);
  };

  const openProductEditor = (product) => {
    setEditingProduct(product);
    setForm({
      name: product.name || '',
      sku: product.sku || '',
      category: product.category || '',
      size: product.size || '',
      cost_price: product.cost_price ?? 0,
      sell_price: product.sell_price ?? 0,
      min_stock: product.min_stock ?? 0,
    });
    setStockForm(buildStockForm(product.id));
    setShowAddProduct(true);
  };

  const openStockEditor = (product) => {
    setStockProduct(product);
    setStockForm(buildStockForm(product.id));
  };

  const stockTotal = Object.values(stockForm).reduce((sum, value) => sum + (Number(value) || 0), 0);

  const renderStockInputs = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Остатки по филиалам</Label>
        <span className="text-xs text-muted-foreground">Итого: {stockTotal} шт.</span>
      </div>
      {branches.length === 0 ? (
        <p className="text-xs text-muted-foreground">Сначала создайте филиалы в разделе «Филиалы».</p>
      ) : (
        <div className="space-y-2 rounded-xl border border-border p-3">
          {branches.map(branch => (
            <div key={branch.id} className="flex items-center justify-between gap-3">
              <span className="text-sm">{branch.name}</span>
              <Input
                type="number"
                min="0"
                className="h-8 w-28"
                value={stockForm[branch.id] ?? 0}
                onChange={e => setStockForm({ ...stockForm, [branch.id]: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <Topbar title="Склад" />
      <div className="p-6 max-w-[1400px]">
        <PageHeader title="Склад и товары" subtitle={`${products.length} товаров`}>
          <Button variant="outline" onClick={() => setShowBulkTransfer(true)} className="gap-1.5">
            <ArrowLeftRight className="w-4 h-4" /> Перемещение
          </Button>
          {canWriteInventory && (
            <Button onClick={openNewProduct} className="gap-1.5 bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4" /> Добавить товар
            </Button>
          )}
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
                  {showRecordActions && <TableHead className="w-12"><span className="sr-only">Действия</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedItems.map(p => (
                  <TableRow key={p.id} className="hover:bg-muted/20">
                    <TableCell data-label="Артикул" className="text-xs text-muted-foreground font-mono">{p.sku || '—'}</TableCell>
                    <TableCell data-label="Название">
                      <div className="text-sm font-medium">{p.name}</div>
                      {p.color && <div className="text-xs text-muted-foreground">{p.color}</div>}
                      {p.is_archived && <div className="text-xs text-muted-foreground">Архив</div>}
                    </TableCell>
                    <TableCell data-label="Категория" className="text-sm">{PRODUCT_CATEGORY_LABELS[p.category]}</TableCell>
                    <TableCell data-label="Размер" className="text-sm">{p.size || '—'}</TableCell>
                    <TableCell data-label="Цена" className="text-sm font-medium">{formatMoney(p.sell_price)}</TableCell>
                    <TableCell data-label="Общий остаток">
                      {canEditProduct ? (
                        <button
                          type="button"
                          onClick={() => openStockEditor(p)}
                          className="text-sm font-semibold underline decoration-dotted underline-offset-4 hover:text-primary"
                          title="Изменить остатки по филиалам"
                        >
                          <span className={p.isLow ? 'text-red-600' : ''}>{p.totalStock}</span>
                        </button>
                      ) : (
                        <span className={`text-sm font-semibold ${p.isLow ? 'text-red-600' : ''}`}>{p.totalStock}</span>
                      )}
                      {p.isLow && <span className="ml-1 text-xs text-red-500">↓</span>}
                    </TableCell>
                    {p.branchStocks.map(bs => (
                      <TableCell key={bs.branch.id} data-label={bs.branch.name || 'Филиал'} className="text-sm">{bs.quantity}</TableCell>
                    ))}
                    {showRecordActions && (
                      <TableCell data-label="Действия">
                        <OwnerActionsMenu
                          onEdit={canEditProduct ? () => openProductEditor(p) : undefined}
                          onEditStock={canEditProduct ? () => openStockEditor(p) : undefined}
                          onDelete={canDelete ? () => setProductToDelete(p) : undefined}
                          onArchive={canArchive && !p.is_archived ? () => ownerProductMutation.mutate({ id: p.id, action: 'archive', reason: 'Архивация товара' }) : undefined}
                          onUnarchive={canArchive && p.is_archived ? () => ownerProductMutation.mutate({ id: p.id, action: 'unarchive', reason: 'Возврат товара из архива' }) : undefined}
                          onViewHistory={() => navigate(`/activity-log?entity_type=inventory&entity_id=${p.id}`)}
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

      {/* Создание и редактирование товара */}
      <Dialog open={showAddProduct} onOpenChange={(open) => { setShowAddProduct(open); if (!open) { setEditingProduct(null); setStockForm({}); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingProduct ? 'Редактировать товар' : 'Новый товар'}</DialogTitle></DialogHeader>
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
              <div className="space-y-1.5"><Label className="text-xs">Себестоимость</Label><Input type="number" min="0" value={form.cost_price ?? 0} onChange={e => setForm({ ...form, cost_price: Math.max(0, Number(e.target.value) || 0) })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Цена продажи *</Label><Input type="number" min="0" value={form.sell_price ?? 0} onChange={e => setForm({ ...form, sell_price: Math.max(0, Number(e.target.value) || 0) })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Мин. остаток</Label><Input type="number" min="0" value={form.min_stock ?? 0} onChange={e => setForm({ ...form, min_stock: Math.max(0, Number(e.target.value) || 0) })} /></div>
            </div>

            {renderStockInputs()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddProduct(false)}>Отмена</Button>
            <Button onClick={() => saveProductMutation.mutate(form)} disabled={!form.name || !form.category || saveProductMutation.isPending} className="bg-primary hover:bg-primary/90">
              {saveProductMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Быстрое изменение остатков */}
      <Dialog open={Boolean(stockProduct)} onOpenChange={(open) => { if (!open) { setStockProduct(null); setStockForm({}); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Boxes className="h-4 w-4 text-primary" /> Остатки: {stockProduct?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">{renderStockInputs()}</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockProduct(null)}>Отмена</Button>
            <Button onClick={() => stockOnlyMutation.mutate()} disabled={stockOnlyMutation.isPending || branches.length === 0} className="bg-primary hover:bg-primary/90">
              {stockOnlyMutation.isPending ? 'Сохранение...' : 'Сохранить остатки'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OwnerDeleteDialog
        open={Boolean(productToDelete)}
        onOpenChange={(open) => !open && setProductToDelete(null)}
        title={productToDelete?.name || 'Товар'}
        details={[
          `SKU: ${productToDelete?.sku || '—'}`,
          `Текущий остаток: ${productToDelete?.totalStock || 0}`,
        ]}
        isPending={ownerProductMutation.isPending}
        onConfirm={(reason) => ownerProductMutation.mutate({ id: productToDelete.id, action: 'delete', reason })}
      />

      <BulkTransferDialog
        open={showBulkTransfer}
        onClose={() => setShowBulkTransfer(false)}
        products={activeProducts}
        branches={branches}
        stockItems={stockItems}
      />
    </div>
  );
}
