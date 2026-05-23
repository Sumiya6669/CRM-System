import React, { useState } from 'react';
import { crm } from '@/services/crm';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Topbar from '@/layouts/Topbar';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatusBadge from '@/components/ui/StatusBadge';
import { Plus } from 'lucide-react';
import { formatMoney } from '@/lib/constants';
import { toast } from 'sonner';

export default function Settings() {
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);
  const [branchForm, setBranchForm] = useState({});
  const [subForm, setSubForm] = useState({});
  const qc = useQueryClient();

  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => crm.entities.Branch.list() });
  const { data: subscriptions = [] } = useQuery({ queryKey: ['subscriptions'], queryFn: () => crm.entities.Subscription.list() });

  const createBranchMutation = useMutation({
    mutationFn: (data) => crm.entities.Branch.create({ ...data, status: 'active' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); setShowAddBranch(false); setBranchForm({}); toast.success('Филиал добавлен'); },
  });

  const createSubMutation = useMutation({
    mutationFn: (data) => crm.entities.Subscription.create({ ...data, status: 'active' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subscriptions'] }); setShowAddSub(false); setSubForm({}); toast.success('Абонемент добавлен'); },
  });

  return (
    <div>
      <Topbar title="Настройки" />
      <div className="p-6 max-w-[1200px]">
        <PageHeader title="Настройки системы" />

        <Tabs defaultValue="branches">
          <TabsList className="mb-4">
            <TabsTrigger value="branches">Филиалы</TabsTrigger>
            <TabsTrigger value="subscriptions">Абонементы</TabsTrigger>
            <TabsTrigger value="org">Организация</TabsTrigger>
          </TabsList>

          <TabsContent value="branches">
            <Card className="rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Филиалы</CardTitle>
                <Button size="sm" onClick={() => setShowAddBranch(true)} className="gap-1 bg-primary hover:bg-primary/90"><Plus className="w-3.5 h-3.5" /> Добавить</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs">Название</TableHead>
                      <TableHead className="text-xs">Город</TableHead>
                      <TableHead className="text-xs">Адрес</TableHead>
                      <TableHead className="text-xs">Телефон</TableHead>
                      <TableHead className="text-xs">Статус</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branches.map(b => (
                      <TableRow key={b.id}>
                        <TableCell className="text-sm font-medium">{b.name}</TableCell>
                        <TableCell className="text-sm">{b.city}</TableCell>
                        <TableCell className="text-sm">{b.address || '—'}</TableCell>
                        <TableCell className="text-sm">{b.phone || '—'}</TableCell>
                        <TableCell><StatusBadge status={b.status} label={b.status === 'active' ? 'Активен' : 'Неактивен'} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscriptions">
            <Card className="rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Виды абонементов</CardTitle>
                <Button size="sm" onClick={() => setShowAddSub(true)} className="gap-1 bg-primary hover:bg-primary/90"><Plus className="w-3.5 h-3.5" /> Добавить</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs">Название</TableHead>
                      <TableHead className="text-xs">Цена</TableHead>
                      <TableHead className="text-xs">Срок (дней)</TableHead>
                      <TableHead className="text-xs">Заморозка</TableHead>
                      <TableHead className="text-xs">Статус</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscriptions.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm font-medium">{s.name}</TableCell>
                        <TableCell className="text-sm">{formatMoney(s.price)}</TableCell>
                        <TableCell className="text-sm">{s.duration_days}</TableCell>
                        <TableCell className="text-sm">{s.can_freeze ? `Да (${s.freeze_days_limit} дн.)` : 'Нет'}</TableCell>
                        <TableCell><StatusBadge status={s.status} label={s.status === 'active' ? 'Активен' : 'Неактивен'} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="org">
            <Card className="rounded-2xl">
              <CardHeader><CardTitle className="text-base">Организация</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label className="text-xs">Название организации</Label><Input defaultValue="TKD Academy" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Страна</Label><Input defaultValue="Казахстан" disabled /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Валюта</Label><Input defaultValue="Тенге (₸)" disabled /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Контактный телефон</Label><Input defaultValue="+7 777 100 00 00" /></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Branch Dialog */}
      <Dialog open={showAddBranch} onOpenChange={setShowAddBranch}>
        <DialogContent>
          <DialogHeader><DialogTitle>Новый филиал</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label className="text-xs">Название *</Label><Input value={branchForm.name || ''} onChange={e => setBranchForm({ ...branchForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Город *</Label><Input value={branchForm.city || ''} onChange={e => setBranchForm({ ...branchForm, city: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Телефон</Label><Input value={branchForm.phone || ''} onChange={e => setBranchForm({ ...branchForm, phone: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Адрес</Label><Input value={branchForm.address || ''} onChange={e => setBranchForm({ ...branchForm, address: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBranch(false)}>Отмена</Button>
            <Button onClick={() => createBranchMutation.mutate(branchForm)} disabled={!branchForm.name || !branchForm.city} className="bg-primary hover:bg-primary/90">Создать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Subscription Dialog */}
      <Dialog open={showAddSub} onOpenChange={setShowAddSub}>
        <DialogContent>
          <DialogHeader><DialogTitle>Новый абонемент</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label className="text-xs">Название *</Label><Input value={subForm.name || ''} onChange={e => setSubForm({ ...subForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Цена *</Label><Input type="number" value={subForm.price || ''} onChange={e => setSubForm({ ...subForm, price: Number(e.target.value) })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Срок (дней) *</Label><Input type="number" value={subForm.duration_days || 30} onChange={e => setSubForm({ ...subForm, duration_days: Number(e.target.value) })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSub(false)}>Отмена</Button>
            <Button onClick={() => createSubMutation.mutate(subForm)} disabled={!subForm.name || !subForm.price} className="bg-primary hover:bg-primary/90">Создать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}