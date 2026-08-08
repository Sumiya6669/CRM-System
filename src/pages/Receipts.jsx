import React, { useMemo, useState } from 'react';
import { crm } from '@/services/crm';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Topbar from '@/layouts/Topbar';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import PaginationBar from '@/components/ui/PaginationBar';
import DocumentLockBadge from '@/components/ui/DocumentLockBadge';
import { formatMoney, formatDate, PRODUCT_CATEGORY_LABELS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Truck, PackagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { usePagination } from '@/hooks/usePagination';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/constants/roles';
import { receiptService } from '@/services/receiptService';
import { OWNER_RECORD_TYPES, ownerActionsService } from '@/services/ownerActionsService';
import OwnerActionsMenu from '@/components/owner/OwnerActionsMenu';
import OwnerDeleteDialog from '@/components/owner/OwnerDeleteDialog';

const emptyLine = () => ({
  key: `line-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  product_id: '', sku: '', product_name: '', quantity: 1, cost_price: 0, sell_price: 0,
});

const emptyNewProduct = { name: '', sku: '', category: 'other', cost_price: 0, sell_price: 0 };

const lineTotal = (line) => (Number(line.quantity) || 0) * (Number(line.cost_price) || 0);

export default function Receipts() {
  const qc = useQueryClient();
  const { can, canEdit, canDelete, canUnlock } = usePermissions();
  const canWrite = can(PERMISSIONS.INVENTORY_WRITE);

  const [showDialog, setShowDialog] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [receiptToDelete, setReceiptToDelete] = useState(null);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProduct, setNewProduct] = useState(emptyNewProduct);
  const [form, setForm] = useState({
    organization_id: '', branch_id: '', document_number: '',
    supplier_name: '', receipt_date: new Date().toISOString().slice(0, 10),
  });
  const [lines, setLines] = useState([emptyLine()]);

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ['receipts'],
    queryFn: () => crm.entities.InventoryReceipt.list('-receipt_date', 300),
  });
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => crm.entities.Branch.list() });
  const { data: organizations = [] } = useQuery({ queryKey: ['organizations'], queryFn: () => crm.entities.Organization.list() });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => crm.entities.Product.list(undefined, 1000) });

  const total = useMemo(() => lines.reduce((sum, line) => sum + lineTotal(line), 0), [lines]);
  const pagination = usePagination(receipts, 50);

  const saveMutation = useMutation({
    mutationFn: async ({ post }) => {
      const branch = branches.find(b => b.id === form.branch_id);
      const payload = {
        branch_id: form.branch_id || null,
        branch_name: branch?.name || null,
        document_number: form.document_number || null,
        supplier_name: form.supplier_name || null,
        receipt_date: form.receipt_date || null,
        total,
        items: lines
          .filter(line => line.product_id)
          .map((line) => ({
            product_id: line.product_id,
            sku: line.sku || null,
            product_name: line.product_name,
            quantity: Math.max(0, Number(line.quantity) || 0),
            cost_price: Number(line.cost_price) || 0,
            sell_price: Number(line.sell_price) || 0,
            total: lineTotal(line),
          })),
      };

      const receipt = editingReceipt
        ? await crm.entities.InventoryReceipt.update(editingReceipt.id, payload)
        : await crm.entities.InventoryReceipt.create({ ...payload, document_status: 'draft' });

      if (post) {
        await receiptService.post(receipt.id);
      }
      return { post };
    },
    onSuccess: ({ post }) => {
      qc.invalidateQueries({ queryKey: ['receipts'] });
      qc.invalidateQueries({ queryKey: ['stockItems'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      closeDialog();
      toast.success(post ? 'Документ проведён, остатки обновлены' : 'Черновик сохранён');
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, reason }) => ownerActionsService.softDelete(OWNER_RECORD_TYPES.INVENTORY_RECEIPT, id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receipts'] });
      setReceiptToDelete(null);
      toast.success('Документ перемещён в корзину');
    },
    onError: (error) => toast.error(error.message),
  });

  const documentMutation = useMutation({
    mutationFn: ({ id, action }) => ownerActionsService.run(OWNER_RECORD_TYPES.INVENTORY_RECEIPT, id, action, 'Документ поступления'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receipts'] });
      toast.success('Действие выполнено');
    },
    onError: (error) => toast.error(error.message),
  });

  const createProductMutation = useMutation({
    mutationFn: (data) => crm.entities.Product.create({
      name: data.name,
      sku: data.sku || null,
      category: data.category || 'other',
      cost_price: Number(data.cost_price) || 0,
      sell_price: Number(data.sell_price) || 0,
      min_stock: 0,
      status: 'active',
    }),
    onSuccess: (product) => {
      qc.invalidateQueries({ queryKey: ['products'] });
      setLines(current => [
        ...current.filter(line => line.product_id),
        {
          ...emptyLine(),
          product_id: product.id,
          sku: product.sku || '',
          product_name: product.name,
          cost_price: product.cost_price || 0,
          sell_price: product.sell_price || 0,
        },
      ]);
      setShowNewProduct(false);
      setNewProduct(emptyNewProduct);
      toast.success('Товар создан и добавлен в документ');
    },
    onError: (error) => toast.error(error.message),
  });

  const closeDialog = () => {
    setShowDialog(false);
    setEditingReceipt(null);
    setLines([emptyLine()]);
  };

  const openNew = async () => {
    setEditingReceipt(null);
    setLines([emptyLine()]);
    let documentNumber = '';
    try {
      documentNumber = await receiptService.nextNumber();
    } catch {
      documentNumber = '';
    }
    setForm({
      organization_id: organizations[0]?.id || '',
      branch_id: branches[0]?.id || '',
      document_number: documentNumber,
      supplier_name: '',
      receipt_date: new Date().toISOString().slice(0, 10),
    });
    setShowDialog(true);
  };

  const openEditor = (receipt) => {
    setEditingReceipt(receipt);
    setForm({
      organization_id: receipt.organization_id || organizations[0]?.id || '',
      branch_id: receipt.branch_id || '',
      document_number: receipt.document_number || '',
      supplier_name: receipt.supplier_name || '',
      receipt_date: receipt.receipt_date || new Date().toISOString().slice(0, 10),
    });
    setLines(
      (Array.isArray(receipt.items) ? receipt.items : []).map(item => ({
        ...emptyLine(),
        product_id: item.product_id || '',
        sku: item.sku || '',
        product_name: item.product_name || '',
        quantity: item.quantity ?? 1,
        cost_price: item.cost_price ?? 0,
        sell_price: item.sell_price ?? 0,
      }))
    );
    setShowDialog(true);
  };

  const updateLine = (key, patch) => {
    setLines(current => current.map(line => (line.key === key ? { ...line, ...patch } : line)));
  };

  const pickProduct = (key, productId) => {
    const product = products.find(p => p.id === productId);
    updateLine(key, {
      product_id: productId,
      sku: product?.sku || '',
      product_name: product?.name || '',
      cost_price: product?.cost_price ?? 0,
      sell_price: product?.sell_price ?? 0,
    });
  };

  const filledLines = lines.filter(line => line.product_id && Number(line.quantity) > 0);
  const canSubmit = Boolean(form.branch_id) && filledLines.length > 0 && !saveMutation.isPending;
  const isPosted = editingReceipt?.document_status === 'posted' || editingReceipt?.is_locked;
  const readOnly = isPosted && !canUnlock;

  return (
    <div>
      <Topbar title="Поступление товара" />
      <div className="p-6 max-w-[1400px]">
        <PageHeader title="Поступление товара" subtitle={`${receipts.length} документов`}>
          {canWrite && (
            <Button onClick={openNew} className="gap-1.5 bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4" /> Новое поступление
            </Button>
          )}
        </PageHeader>

        {isLoading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
        ) : receipts.length === 0 ? (
          <EmptyState icon={Truck} title="Нет документов поступления" description="Создайте первый документ, чтобы оприходовать товар на склад" />
        ) : (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <Table className="responsive-card-table">
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-semibold">№ документа</TableHead>
                  <TableHead className="text-xs font-semibold">Дата</TableHead>
                  <TableHead className="text-xs font-semibold">Склад</TableHead>
                  <TableHead className="text-xs font-semibold">Поставщик</TableHead>
                  <TableHead className="text-xs font-semibold">Позиций</TableHead>
                  <TableHead className="text-xs font-semibold">Сумма</TableHead>
                  <TableHead className="text-xs font-semibold">Документ</TableHead>
                  <TableHead className="w-12"><span className="sr-only">Действия</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedItems.map(receipt => (
                  <TableRow key={receipt.id} className="hover:bg-muted/20">
                    <TableCell data-label="№ документа" className="text-sm font-medium">{receipt.document_number || '—'}</TableCell>
                    <TableCell data-label="Дата" className="text-sm">{formatDate(receipt.receipt_date)}</TableCell>
                    <TableCell data-label="Склад" className="text-sm">{receipt.branch_name || '—'}</TableCell>
                    <TableCell data-label="Поставщик" className="text-sm">{receipt.supplier_name || '—'}</TableCell>
                    <TableCell data-label="Позиций" className="text-sm">{(receipt.items || []).length}</TableCell>
                    <TableCell data-label="Сумма" className="text-sm font-medium">{formatMoney(receipt.total)}</TableCell>
                    <TableCell data-label="Документ">
                      <DocumentLockBadge
                        document={receipt}
                        onUnlock={canUnlock ? () => documentMutation.mutate({ id: receipt.id, action: 'unlock' }) : undefined}
                        isUnlocking={documentMutation.isPending}
                      />
                    </TableCell>
                    <TableCell data-label="Действия">
                      <OwnerActionsMenu
                        onEdit={canWrite || canEdit ? () => openEditor(receipt) : undefined}
                        onDelete={canDelete ? () => setReceiptToDelete(receipt) : undefined}
                        onReopen={canUnlock && receipt.document_status === 'posted' ? () => documentMutation.mutate({ id: receipt.id, action: 'reopen' }) : undefined}
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

      {/* Документ поступления */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingReceipt ? `Поступление ${editingReceipt.document_number || ''}` : 'Новое поступление товара'}
            </DialogTitle>
          </DialogHeader>

          {readOnly && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Документ проведён и заблокирован. Чтобы изменить его, нужен пункт «Открыть заново» —
              он доступен пользователю с правом работы с проведёнными документами.
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Организация</Label>
                <Select value={form.organization_id || ''} onValueChange={v => setForm({ ...form, organization_id: v })} disabled={readOnly}>
                  <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>{organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Склад / филиал *</Label>
                <Select value={form.branch_id || ''} onValueChange={v => setForm({ ...form, branch_id: v })} disabled={readOnly}>
                  <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">№ документа</Label>
                <Input value={form.document_number || ''} onChange={e => setForm({ ...form, document_number: e.target.value })} disabled={readOnly} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Дата</Label>
                <Input type="date" value={form.receipt_date || ''} onChange={e => setForm({ ...form, receipt_date: e.target.value })} disabled={readOnly} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Поставщик</Label>
              <Input value={form.supplier_name || ''} onChange={e => setForm({ ...form, supplier_name: e.target.value })} placeholder="ТОО «Поставщик»" disabled={readOnly} />
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs">Позиции документа</Label>
                {!readOnly && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowNewProduct(true)} className="gap-1.5">
                      <PackagePlus className="w-3.5 h-3.5" /> Новый товар
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setLines([...lines, emptyLine()])}>
                      + Добавить позицию
                    </Button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="p-2 text-left text-xs font-semibold">Артикул</th>
                      <th className="p-2 text-left text-xs font-semibold min-w-[180px]">Наименование</th>
                      <th className="p-2 text-left text-xs font-semibold">Кол-во</th>
                      <th className="p-2 text-left text-xs font-semibold">Себестоимость</th>
                      <th className="p-2 text-left text-xs font-semibold">Цена продажи</th>
                      <th className="p-2 text-right text-xs font-semibold">Сумма</th>
                      {!readOnly && <th className="w-10" />}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map(line => (
                      <tr key={line.key} className="border-t border-border">
                        <td className="p-2 font-mono text-xs text-muted-foreground">{line.sku || '—'}</td>
                        <td className="p-2">
                          <Select value={line.product_id || ''} onValueChange={v => pickProduct(line.key, v)} disabled={readOnly}>
                            <SelectTrigger className="h-8"><SelectValue placeholder="Выберите товар" /></SelectTrigger>
                            <SelectContent>
                              {products.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}{p.size ? ` (${p.size})` : ''}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Input type="number" min="1" className="h-8 w-20" value={line.quantity}
                            onChange={e => updateLine(line.key, { quantity: Math.max(0, Number(e.target.value) || 0) })} disabled={readOnly} />
                        </td>
                        <td className="p-2">
                          <Input type="number" min="0" className="h-8 w-28" value={line.cost_price}
                            onChange={e => updateLine(line.key, { cost_price: Math.max(0, Number(e.target.value) || 0) })} disabled={readOnly} />
                        </td>
                        <td className="p-2">
                          <Input type="number" min="0" className="h-8 w-28" value={line.sell_price}
                            onChange={e => updateLine(line.key, { sell_price: Math.max(0, Number(e.target.value) || 0) })} disabled={readOnly} />
                        </td>
                        <td className="p-2 text-right font-medium whitespace-nowrap">{formatMoney(lineTotal(line))}</td>
                        {!readOnly && (
                          <td className="p-2">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" title="Удалить позицию"
                              onClick={() => setLines(lines.length > 1 ? lines.filter(l => l.key !== line.key) : [emptyLine()])}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-6 pt-1 text-sm">
                <span className="text-muted-foreground">Позиций: {filledLines.length}</span>
                <span className="font-semibold">Итого: {formatMoney(total)}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeDialog}>Закрыть</Button>
            {!readOnly && (
              <>
                <Button variant="outline" onClick={() => saveMutation.mutate({ post: false })} disabled={!canSubmit}>
                  {saveMutation.isPending ? 'Сохранение...' : 'Сохранить черновик'}
                </Button>
                <Button onClick={() => saveMutation.mutate({ post: true })} disabled={!canSubmit} className="bg-primary hover:bg-primary/90">
                  Провести и оприходовать
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Быстрое создание товара прямо из документа */}
      <Dialog open={showNewProduct} onOpenChange={setShowNewProduct}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Новый товар</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label className="text-xs">Наименование *</Label><Input value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Артикул</Label><Input value={newProduct.sku} onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label className="text-xs">Категория</Label>
                <Select value={newProduct.category} onValueChange={v => setNewProduct({ ...newProduct, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRODUCT_CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Себестоимость</Label><Input type="number" min="0" value={newProduct.cost_price} onChange={e => setNewProduct({ ...newProduct, cost_price: Math.max(0, Number(e.target.value) || 0) })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Цена продажи</Label><Input type="number" min="0" value={newProduct.sell_price} onChange={e => setNewProduct({ ...newProduct, sell_price: Math.max(0, Number(e.target.value) || 0) })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewProduct(false)}>Отмена</Button>
            <Button onClick={() => createProductMutation.mutate(newProduct)} disabled={!newProduct.name || createProductMutation.isPending} className="bg-primary hover:bg-primary/90">
              {createProductMutation.isPending ? 'Создание...' : 'Создать и добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OwnerDeleteDialog
        open={Boolean(receiptToDelete)}
        onOpenChange={(open) => !open && setReceiptToDelete(null)}
        title={`Поступление ${receiptToDelete?.document_number || ''}`}
        details={[
          `Дата: ${formatDate(receiptToDelete?.receipt_date) || '—'}`,
          `Склад: ${receiptToDelete?.branch_name || '—'}`,
          `Сумма: ${formatMoney(receiptToDelete?.total || 0)}`,
        ]}
        isPending={deleteMutation.isPending}
        onConfirm={(reason) => deleteMutation.mutate({ id: receiptToDelete.id, reason })}
      />
    </div>
  );
}
