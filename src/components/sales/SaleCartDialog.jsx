import React, { useState, useMemo } from 'react';
import { crm } from '@/services/crm';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchableSelect from '@/components/search/SearchableSelect';
import { formatMoney, PAYMENT_METHOD_LABELS, PRODUCT_CATEGORY_LABELS } from '@/lib/constants';
import { Search, Trash2, Plus, Minus, ShoppingCart, Tag, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function SaleCartDialog({ open, onClose, products, students, branches, stockItems }) {
  const [step, setStep] = useState(1);
  const [branchId, setBranchId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [discount, setDiscount] = useState(0);
  const [comment, setComment] = useState('');
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const filteredProducts = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(p => (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));
  }, [products, search]);

  const getStock = (productId) => {
    if (!branchId) return 0;
    return stockItems.find(s => s.product_id === productId && s.branch_id === branchId)?.quantity || 0;
  };

  const addToCart = (p) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === p.id);
      if (existing) return prev.map(i => i.productId === p.id ? { ...i, qty: Math.min(i.qty + 1, getStock(p.id) || 999) } : i);
      return [...prev, { productId: p.id, product: p, qty: 1, price: p.sell_price }];
    });
  };

  const removeFromCart = (productId) => setCart(prev => prev.filter(i => i.productId !== productId));
  const setQty = (productId, qty) => {
    const max = getStock(productId) || 999;
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, qty: Math.max(1, Math.min(Number(qty) || 1, max)) } : i));
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountAmount = Math.round(subtotal * (discount / 100));
  const total = subtotal - discountAmount;

  const studentItems = useMemo(() => students.filter(s => s.status === 'active').map(s => ({
    value: s.id, label: s.full_name, sub: `${s.branch_name} · ${s.parent_phone || ''}`,
  })), [students]);

  const branchItems = useMemo(() => branches.map(b => ({ value: b.id, label: b.name, sub: b.city })), [branches]);

  const saleMutation = useMutation({
    mutationFn: async () => {
      const branch = branches.find(b => b.id === branchId);
      const student = students.find(s => s.id === studentId);
      const saleDate = new Date().toISOString().split('T')[0];

      for (const item of cart) {
        const stockItem = stockItems.find(s => s.product_id === item.productId && s.branch_id === branchId);
        if (stockItem) {
          await crm.entities.StockItem.update(stockItem.id, { quantity: Math.max(0, stockItem.quantity - item.qty) });
        }
        const itemTotal = item.price * item.qty * (1 - discount / 100);
        await crm.entities.Sale.create({
          product_id: item.productId, product_name: item.product.name,
          student_id: studentId, student_name: student?.full_name,
          buyer_name: buyerName || student?.full_name || 'Покупатель',
          branch_id: branchId, branch_name: branch?.name,
          quantity: item.qty, unit_price: item.price,
          total: Math.round(itemTotal),
          payment_method: paymentMethod,
          sale_date: saleDate, comment,
        });
      }
      await crm.entities.ActivityLog.create({
        action_type: 'sale_completed',
        description: `Продажа ${cart.length} поз. — ${formatMoney(total)} (${student?.full_name || buyerName || 'Покупатель'})`,
        entity_type: 'Sale', branch_id: branchId, branch_name: branch?.name, amount: total,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['stockItems'] });
      toast.success(`Продажа оформлена на ${formatMoney(total)}`);
      handleClose();
    },
  });

  const handleClose = () => {
    setStep(1); setBranchId(''); setStudentId(''); setBuyerName(''); setPaymentMethod('');
    setDiscount(0); setComment(''); setCart([]); setSearch('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Новая продажа
            {cart.length > 0 && <span className="ml-auto text-xs font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">{cart.length} поз.</span>}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="flex gap-4 flex-1 min-h-0">
            {/* Left: product catalog */}
            <div className="flex-1 min-w-0 flex flex-col gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Филиал *</Label>
                <SearchableSelect items={branchItems} value={branchId} onChange={v => { setBranchId(v); setCart([]); }} placeholder="Выберите филиал" />
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск товаров..." className="pl-9 h-9 text-sm" />
              </div>
              <div className="flex-1 overflow-y-auto border border-border rounded-xl divide-y divide-border max-h-64">
                {filteredProducts.map(p => {
                  const stock = getStock(p.id);
                  const inCart = cart.find(i => i.productId === p.id);
                  return (
                    <button key={p.id} type="button" onClick={() => addToCart(p)}
                      disabled={branchId && stock === 0}
                      className={cn("w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 text-left transition-colors disabled:opacity-40",
                        inCart && "bg-primary/5")}>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{PRODUCT_CATEGORY_LABELS[p.category]}{branchId ? ` · ${stock} шт.` : ''}</div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className="text-sm font-semibold">{formatMoney(p.sell_price)}</div>
                        {inCart && <div className="text-xs text-primary font-medium">+</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: cart */}
            <div className="w-64 flex flex-col gap-3 shrink-0">
              <Label className="text-xs">Корзина</Label>
              <div className="flex-1 border border-border rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="flex items-center justify-center h-full py-8 text-sm text-muted-foreground">Добавьте товары</div>
                ) : (
                  <div className="divide-y divide-border">
                    {cart.map(item => (
                      <div key={item.productId} className="px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="text-xs font-medium leading-tight">{item.product.name}</div>
                          <button onClick={() => removeFromCart(item.productId)} className="text-muted-foreground hover:text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => setQty(item.productId, item.qty - 1)} className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted">
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                            <span className="text-xs w-6 text-center">{item.qty}</span>
                            <button type="button" onClick={() => setQty(item.productId, item.qty + 1)} className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted">
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>
                          <span className="text-xs font-semibold">{formatMoney(item.price * item.qty)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {cart.length > 0 && (
                <div className="space-y-1 p-3 bg-muted/50 rounded-xl text-xs">
                  <div className="flex justify-between"><span>Сумма:</span><span className="font-medium">{formatMoney(subtotal)}</span></div>
                  {discount > 0 && <div className="flex justify-between text-emerald-600"><span>Скидка {discount}%:</span><span>-{formatMoney(discountAmount)}</span></div>}
                  <div className="flex justify-between font-bold text-sm border-t border-border pt-1 mt-1"><span>Итого:</span><span>{formatMoney(total)}</span></div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Ученик (необязательно)</Label>
              <SearchableSelect items={studentItems} value={studentId} onChange={setStudentId} placeholder="Выберите ученика" />
            </div>
            {!studentId && (
              <div className="space-y-1.5">
                <Label className="text-xs">Имя покупателя</Label>
                <Input value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder="Введите имя" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Способ оплаты *</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>{Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Tag className="w-3 h-3" /> Скидка %</Label>
                <Input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))} min={0} max={100} placeholder="0" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Комментарий</Label>
              <Input value={comment} onChange={e => setComment(e.target.value)} placeholder="Необязательно" />
            </div>
            {/* Summary */}
            <div className="bg-muted/50 rounded-xl p-4 space-y-1 text-sm">
              {cart.map(i => (
                <div key={i.productId} className="flex justify-between text-xs">
                  <span>{i.product.name} × {i.qty}</span>
                  <span>{formatMoney(i.price * i.qty)}</span>
                </div>
              ))}
              <div className="border-t border-border pt-2 mt-2 flex justify-between font-bold">
                <span>Итого к оплате:</span>
                <span className="text-base">{formatMoney(total)}</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={handleClose}>Отмена</Button>
              <Button onClick={() => setStep(2)} disabled={cart.length === 0 || !branchId} className="bg-primary hover:bg-primary/90">
                Далее <ArrowRight className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>Назад</Button>
              <Button onClick={() => saleMutation.mutate()} disabled={!paymentMethod || saleMutation.isPending} className="bg-primary hover:bg-primary/90">
                {saleMutation.isPending ? 'Оформление...' : `Оформить — ${formatMoney(total)}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}