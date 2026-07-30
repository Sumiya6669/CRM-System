import React, { useState } from 'react';
import { crm } from '@/services/crm';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Topbar from '@/layouts/Topbar';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatMoney } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Dumbbell, Users, CreditCard, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/constants/roles';
import OwnerActionsMenu from '@/components/owner/OwnerActionsMenu';
import OwnerDeleteDialog from '@/components/owner/OwnerDeleteDialog';

const emptyForm = { full_name: '', branch_id: '', phone: '', belt: '', hire_date: '', status: 'active' };

export default function Coaches() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingCoach, setEditingCoach] = useState(null);
  const [coachToDelete, setCoachToDelete] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const qc = useQueryClient();
  const { can, canEdit, canDelete } = usePermissions();

  const canWrite = can(PERMISSIONS.TRAINERS_WRITE);
  const canEditCoach = canWrite || canEdit;
  const showActions = canEditCoach || canDelete;

  const { data: coaches = [], isLoading } = useQuery({ queryKey: ['coaches'], queryFn: () => crm.entities.Coach.list() });
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => crm.entities.Branch.list() });
  const { data: students = [] } = useQuery({ queryKey: ['students'], queryFn: () => crm.entities.Student.list('-created_date', 500) });
  const { data: groups = [] } = useQuery({ queryKey: ['groups'], queryFn: () => crm.entities.Group.list() });
  const { data: payments = [] } = useQuery({ queryKey: ['payments'], queryFn: () => crm.entities.Payment.list('-payment_date', 500) });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const branch = branches.find(b => b.id === data.branch_id);
      const payload = { ...data, branch_name: branch?.name, status: data.status || 'active' };
      return editingCoach
        ? crm.entities.Coach.update(editingCoach.id, payload)
        : crm.entities.Coach.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coaches'] });
      setShowDialog(false);
      setEditingCoach(null);
      setForm(emptyForm);
      toast.success(editingCoach ? 'Данные тренера обновлены' : 'Тренер добавлен');
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => crm.entities.Coach.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coaches'] });
      setCoachToDelete(null);
      toast.success('Тренер удалён');
    },
    onError: (error) => toast.error(error.message),
  });

  const openNew = () => {
    setEditingCoach(null);
    setForm(emptyForm);
    setShowDialog(true);
  };

  const openEditor = (coach) => {
    setEditingCoach(coach);
    setForm({
      full_name: coach.full_name || '',
      branch_id: coach.branch_id || '',
      phone: coach.phone || '',
      belt: coach.belt || '',
      hire_date: coach.hire_date || '',
      status: coach.status || 'active',
    });
    setShowDialog(true);
  };

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return (
    <div>
      <Topbar title="Тренеры" />
      <div className="p-6 max-w-[1400px]">
        <PageHeader title="Тренеры" subtitle={`${coaches.length} тренеров`}>
          {canWrite && (
            <Button onClick={openNew} className="gap-1.5 bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4" /> Добавить тренера
            </Button>
          )}
        </PageHeader>

        {isLoading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
        ) : coaches.length === 0 ? (
          <EmptyState icon={Dumbbell} title="Нет тренеров" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coaches.map(coach => {
              const coachStudents = students.filter(s => s.coach_id === coach.id && s.status === 'active');
              const coachGroups = groups.filter(g => g.coach_id === coach.id);
              const coachRevenue = payments
                .filter(p => coachStudents.some(s => s.id === p.student_id) && p.payment_date?.startsWith(thisMonth) && p.status !== 'cancelled')
                .reduce((s, p) => s + (p.amount || 0), 0);

              return (
                <Card key={coach.id} className="rounded-2xl border-border hover:shadow-md transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-lg font-bold text-accent-foreground">
                        {coach.full_name?.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold">{coach.full_name}</h3>
                          <StatusBadge status={coach.status} label={coach.status === 'active' ? 'Активен' : 'Неактивен'} />
                        </div>
                        <p className="text-xs text-muted-foreground">{coach.branch_name} · {coach.belt || ''}</p>
                        {coach.phone && <p className="text-xs text-muted-foreground">{coach.phone}</p>}
                      </div>
                      {showActions && (
                        <OwnerActionsMenu
                          onEdit={canEditCoach ? () => openEditor(coach) : undefined}
                          onDelete={canDelete ? () => setCoachToDelete(coach) : undefined}
                        />
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-2 rounded-lg bg-muted/40">
                        <Users className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                        <div className="text-lg font-bold">{coachStudents.length}</div>
                        <div className="text-xs text-muted-foreground">Учеников</div>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/40">
                        <Calendar className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                        <div className="text-lg font-bold">{coachGroups.length}</div>
                        <div className="text-xs text-muted-foreground">Групп</div>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/40">
                        <CreditCard className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                        <div className="text-sm font-bold">{formatMoney(coachRevenue)}</div>
                        <div className="text-xs text-muted-foreground">Выручка</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) setEditingCoach(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCoach ? 'Редактировать тренера' : 'Новый тренер'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label className="text-xs">ФИО *</Label><Input value={form.full_name || ''} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Филиал *</Label>
                <Select value={form.branch_id || ''} onValueChange={v => setForm({ ...form, branch_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Телефон</Label><Input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Пояс / Дан</Label><Input value={form.belt || ''} onChange={e => setForm({ ...form, belt: e.target.value })} placeholder="Чёрный 3 дан" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Дата найма</Label><Input type="date" value={form.hire_date || ''} onChange={e => setForm({ ...form, hire_date: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Статус</Label>
              <Select value={form.status || 'active'} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Активен</SelectItem>
                  <SelectItem value="inactive">Неактивен</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Отмена</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.full_name || !form.branch_id || saveMutation.isPending} className="bg-primary hover:bg-primary/90">
              {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OwnerDeleteDialog
        open={Boolean(coachToDelete)}
        onOpenChange={(open) => !open && setCoachToDelete(null)}
        title={coachToDelete?.full_name || 'Тренер'}
        details={[
          `Филиал: ${coachToDelete?.branch_name || '—'}`,
          `Телефон: ${coachToDelete?.phone || '—'}`,
        ]}
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(coachToDelete.id)}
      />
    </div>
  );
}
