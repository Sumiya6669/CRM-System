import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { crm } from '@/services/crm';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Topbar from '@/layouts/Topbar';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatMoney, formatDate, getAge, BELT_LABELS, STATUS_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Archive, ArrowLeftRight, Phone, Calendar, MapPin, Award } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function StudentDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({});

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: () => crm.entities.Student.list().then(list => list.find(s => s.id === id)),
  });
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => crm.entities.Branch.list() });
  const { data: payments = [] } = useQuery({
    queryKey: ['studentPayments', id],
    queryFn: () => crm.entities.Payment.filter({ student_id: id }, '-payment_date', 50),
  });
  const { data: attendance = [] } = useQuery({
    queryKey: ['studentAttendance', id],
    queryFn: () => crm.entities.Attendance.filter({ student_id: id }, '-date', 50),
  });
  const { data: transfers = [] } = useQuery({
    queryKey: ['studentTransfers', id],
    queryFn: () => crm.entities.StudentTransfer.filter({ student_id: id }, '-transfer_date', 50),
  });

  const archiveMutation = useMutation({
    mutationFn: () => crm.entities.Student.update(id, { status: 'archived' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['student', id] }); toast.success('Ученик архивирован'); },
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      const toBranch = branches.find(b => b.id === transferForm.to_branch_id);
      await crm.entities.Student.update(id, { branch_id: transferForm.to_branch_id, branch_name: toBranch?.name });
      await crm.entities.StudentTransfer.create({
        student_id: id,
        student_name: student.full_name,
        from_branch_id: student.branch_id,
        from_branch_name: student.branch_name,
        to_branch_id: transferForm.to_branch_id,
        to_branch_name: toBranch?.name,
        transfer_date: new Date().toISOString().split('T')[0],
        reason: transferForm.reason,
      });
      await crm.entities.ActivityLog.create({
        action_type: 'student_transferred',
        description: `${student.full_name} переведён из ${student.branch_name} в ${toBranch?.name}`,
        entity_type: 'Student', entity_id: id, branch_id: transferForm.to_branch_id, branch_name: toBranch?.name,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student', id] });
      qc.invalidateQueries({ queryKey: ['studentTransfers', id] });
      setShowTransfer(false);
      toast.success('Ученик переведён');
    },
  });

  if (isLoading || !student) {
    return (
      <div>
        <Topbar title="Ученик" />
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      </div>
    );
  }

  const totalPayments = payments.filter(p => p.status !== 'cancelled').reduce((s, p) => s + (p.amount || 0), 0);
  const attendanceRate = attendance.length > 0
    ? Math.round((attendance.filter(a => a.present).length / attendance.length) * 100) : 0;

  return (
    <div>
      <Topbar title={student.full_name} />
      <div className="p-6 max-w-[1200px]">
        <Link to="/students" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Назад к списку
        </Link>

        {/* Header card */}
        <Card className="rounded-2xl border-border mb-6">
          <CardContent className="p-6">
            <div className="flex items-start gap-6">
              <div className="w-20 h-20 rounded-2xl bg-accent flex items-center justify-center text-2xl font-bold text-accent-foreground shrink-0">
                {student.full_name?.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-xl font-bold">{student.full_name}</h2>
                  <StatusBadge status={student.status} label={STATUS_LABELS[student.status]} />
                </div>
                <div className="text-sm text-muted-foreground mb-3">{student.student_id} · {student.branch_name} · {student.group_name || 'Без группы'}</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-muted-foreground" /><span>{getAge(student.birth_date)} лет</span></div>
                  <div className="flex items-center gap-2"><Award className="w-4 h-4 text-muted-foreground" /><span>{BELT_LABELS[student.belt] || 'Белый'} пояс</span></div>
                  <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /><span>{student.parent_phone || '—'}</span></div>
                  <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground" /><span>{student.branch_name}</span></div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowTransfer(true)} className="gap-1"><ArrowLeftRight className="w-3.5 h-3.5" /> Перевести</Button>
                <Button variant="outline" size="sm" onClick={() => archiveMutation.mutate()} className="gap-1 text-red-600 hover:text-red-700"><Archive className="w-3.5 h-3.5" /> Архив</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="rounded-2xl p-4">
            <div className="text-xs text-muted-foreground mb-1">Оплачено до</div>
            <div className="text-lg font-bold">{formatDate(student.paid_until)}</div>
          </Card>
          <Card className="rounded-2xl p-4">
            <div className="text-xs text-muted-foreground mb-1">Задолженность</div>
            <div className="text-lg font-bold text-red-600">{formatMoney(student.debt)}</div>
          </Card>
          <Card className="rounded-2xl p-4">
            <div className="text-xs text-muted-foreground mb-1">Всего оплачено</div>
            <div className="text-lg font-bold">{formatMoney(totalPayments)}</div>
          </Card>
          <Card className="rounded-2xl p-4">
            <div className="text-xs text-muted-foreground mb-1">Посещаемость</div>
            <div className="text-lg font-bold">{attendanceRate}%</div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payments */}
          <Card className="rounded-2xl border-border">
            <CardHeader className="pb-3"><CardTitle className="text-base">История оплат</CardTitle></CardHeader>
            <CardContent>
              {payments.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Нет оплат</p> : (
                <div className="space-y-2">
                  {payments.slice(0, 10).map(p => (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <div className="text-sm font-medium">{formatMoney(p.amount)}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(p.payment_date)} · {PAYMENT_METHOD_LABELS[p.payment_method] || p.payment_method}</div>
                      </div>
                      <StatusBadge status={p.status} label={PAYMENT_STATUS_LABELS[p.status]} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attendance */}
          <Card className="rounded-2xl border-border">
            <CardHeader className="pb-3"><CardTitle className="text-base">Посещения</CardTitle></CardHeader>
            <CardContent>
              {attendance.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Нет записей</p> : (
                <div className="space-y-2">
                  {attendance.slice(0, 10).map(a => (
                    <div key={a.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="text-sm">{formatDate(a.date)}</div>
                      <StatusBadge status={a.present ? 'active' : 'archived'} label={a.present ? 'Присутствовал' : 'Пропуск'} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transfers */}
          {transfers.length > 0 && (
            <Card className="rounded-2xl border-border lg:col-span-2">
              <CardHeader className="pb-3"><CardTitle className="text-base">История переводов</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {transfers.map(t => (
                    <div key={t.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <div className="text-sm">{t.from_branch_name} → {t.to_branch_name}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(t.transfer_date)}{t.reason && ` · ${t.reason}`}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Transfer dialog */}
      <Dialog open={showTransfer} onOpenChange={setShowTransfer}>
        <DialogContent>
          <DialogHeader><DialogTitle>Перевод ученика</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm">Из: <span className="font-medium">{student.branch_name}</span></div>
            <div className="space-y-1.5">
              <Label className="text-xs">В филиал *</Label>
              <Select value={transferForm.to_branch_id || ''} onValueChange={v => setTransferForm({ ...transferForm, to_branch_id: v })}>
                <SelectTrigger><SelectValue placeholder="Выберите филиал" /></SelectTrigger>
                <SelectContent>
                  {branches.filter(b => b.id !== student.branch_id).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Причина</Label>
              <Textarea value={transferForm.reason || ''} onChange={e => setTransferForm({ ...transferForm, reason: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransfer(false)}>Отмена</Button>
            <Button onClick={() => transferMutation.mutate()} disabled={!transferForm.to_branch_id || transferMutation.isPending} className="bg-primary hover:bg-primary/90">Перевести</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
