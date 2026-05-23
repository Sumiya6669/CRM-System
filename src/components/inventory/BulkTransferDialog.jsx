import React, { useState, useMemo } from 'react';
import { crm } from '@/services/crm';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Minus, ArrowRight, Package, CheckSquare } from 'lucide-react';
import { PRODUCT_CATEGORY_LABELS } from '@/lib/constants';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function BulkTransferDialog({ open, onClose, products, branches, stockItems }) {
  const [step, setStep] = useState(1); // 1=select, 2=confirm
  const [fromBranch, setFromBranch] = useState('');
  const [toBranch, setToBranch] = useState('');
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState({}); // { productId: quantity }
  const qc = useQueryClient();

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (!search) return true;
      return (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.sku || '').toLowerCase().includes(search.toLowerCase());
    });
  }, [products, search]);

  const getAvailableStock = (productId) => {
    if (!fromBranch) return 0;
    const si = stockItems.find(s => s.product_id === productId && s.branch_id === fromBranch);
    return si?.quantity || 0;
  };

  const toggleProduct = (p) => {
    setSelected(prev => {
      if (prev[p.id]) {
        const n = { ...prev };
        delete n[p.id];
        return n;
      }
      const avail = getAvailableStock(p.id);
      return { ...prev, [p.id]: Math.min(1, avail) };
    });
  };

  const setQty = (id, qty) => {
    const max = getAvailableStock(id);
    const val = Math.max(1, Math.min(Number(qty) || 1, max));
    setSelected(prev => ({ ...prev, [id]: val }));
  };

  const selectedEntries = Object.entries(selected).map(([id, qty]) => ({
    product: products.find(p => p.id === id),
    qty,
    available: getAvailableStock(id),
  })).filter(e => e.product);

  const transferMutation = useMutation({
    mutationFn: async () => {
      const from = branches.find(b => b.id === fromBranch);
      const to = branches.find(b => b.id === toBranch);
      for (const { product, qty } of selectedEntries) {
        const fromStock = stockItems.find(s => s.product_id === product.id && s.branch_id === fromBranch);
        const toStock = stockItems.find(s => s.product_id === product.id && s.branch_id === toBranch);
        if (fromStock) await crm.entities.StockItem.update(fromStock.id, { quantity: Math.max(0, fromStock.quantity - qty) });
        if (toStock) {
          await crm.entities.StockItem.update(toStock.id, { quantity: (toStock.quantity || 0) + qty });
        } else {
          await crm.entities.StockItem.create({ product_id: product.id, product_name: product.name, branch_id: toBranch, branch_name: to?.name, quantity: qty });
        }
        await crm.entities.StockTransfer.create({
          product_id: product.id, product_name: product.name,
          from_branch_id: fromBranch, from_branch_name: from?.name,
          to_branch_id: toBranch, to_branch_name: to?.name,
          quantity: qty, reason, transfer_date: new Date().toISOString().split('T')[0],
        });
      }
      await crm.entities.ActivityLog.create({
        action_type: 'stock_transferred',
        description: `Перемещение ${selectedEntries.length} позиций из ${from?.name} в ${to?.name}`,
        entity_type: 'StockTransfer', branch_name: from?.name, quantity: selectedEntries.reduce((s, e) => s + e.qty, 0),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stockItems'] });
      toast.success(`Перемещено ${selectedEntries.length} позиций`);
      handleClose();
    },
  });

  const handleClose = () => {
    setStep(1); setFromBranch(''); setToBranch(''); setReason(''); setSearch(''); setSelected({});
    onClose();
  };

  const canProceed = fromBranch && toBranch && fromBranch !== toBranch && selectedEntries.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Перемещение товаров
            {selectedEntries.length > 0 && (
              <span className="ml-auto text-xs font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">{selectedEntries.length} позиций</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            {/* Branch selection */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Из филиала *</Label>
                <Select value={fromBranch} onValueChange={v => { setFromBranch(v); setSelected({}); }}>
                  <SelectTrigger><SelectValue placeholder="Откуда" /></SelectTrigger>
                  <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">В филиал *</Label>
                <Select value={toBranch} onValueChange={setToBranch}>
                  <SelectTrigger><SelectValue placeholder="Куда" /></SelectTrigger>
                  <SelectContent>{branches.filter(b => b.id !== fromBranch).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Product search & select */}
            <div className="space-y-1.5 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Выберите товары</Label>
                {Object.keys(selected).length > 0 && (
                  <button onClick={() => setSelected({})} className="text-xs text-muted-foreground hover:text-foreground">Сбросить</button>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по названию, артикулу..." className="pl-9 h-9 text-sm" />
              </div>
              <div className="flex-1 overflow-y-auto border border-border rounded-xl divide-y divide-border max-h-64">
                {filteredProducts.map(p => {
                  const avail = getAvailableStock(p.id);
                  const isSelected = !!selected[p.id];
                  const disabled = fromBranch && avail === 0;
                  return (
                    <div key={p.id} className={cn("flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors", disabled && "opacity-40 cursor-not-allowed", isSelected && "bg-primary/5")}>
                      <button type="button" onClick={() => !disabled && toggleProduct(p)} className="shrink-0">
                        <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                          isSelected ? "bg-primary border-primary" : "border-border hover:border-primary/50"
                        )}>
                          {isSelected && <CheckSquare className="w-3 h-3 text-white" />}
                        </div>
                      </button>
                      <div className="flex-1 min-w-0" onClick={() => !disabled && toggleProduct(p)}>
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{PRODUCT_CATEGORY_LABELS[p.category]}{p.sku ? ` · ${p.sku}` : ''}{fromBranch ? ` · Доступно: ${avail}` : ''}</div>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                          <button type="button" onClick={() => setQty(p.id, selected[p.id] - 1)} className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted">
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number" value={selected[p.id]} min={1} max={avail}
                            onChange={e => setQty(p.id, e.target.value)}
                            className="w-12 h-7 text-center text-sm border border-border rounded-lg bg-transparent outline-none focus:ring-1 focus:ring-primary"
                          />
                          <button type="button" onClick={() => setQty(p.id, selected[p.id] + 1)} className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Причина перемещения</Label>
              <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Необязательно" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 flex-1 overflow-y-auto">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl text-sm">
              <span className="font-medium">{branches.find(b => b.id === fromBranch)?.name}</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{branches.find(b => b.id === toBranch)?.name}</span>
            </div>
            <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
              {selectedEntries.map(({ product, qty }) => (
                <div key={product.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">{product.name}</div>
                    <div className="text-xs text-muted-foreground">{PRODUCT_CATEGORY_LABELS[product.category]}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{qty} шт.</div>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                <span className="text-sm font-semibold">Итого</span>
                <span className="text-sm font-bold">{selectedEntries.length} позиций · {selectedEntries.reduce((s, e) => s + e.qty, 0)} шт.</span>
              </div>
            </div>
            {reason && <p className="text-sm text-muted-foreground">Причина: {reason}</p>}
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={handleClose}>Отмена</Button>
              <Button onClick={() => setStep(2)} disabled={!canProceed} className="bg-primary hover:bg-primary/90">
                Далее ({selectedEntries.length}) <ArrowRight className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>Назад</Button>
              <Button onClick={() => transferMutation.mutate()} disabled={transferMutation.isPending} className="bg-primary hover:bg-primary/90">
                {transferMutation.isPending ? 'Перемещение...' : `Подтвердить перемещение`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}