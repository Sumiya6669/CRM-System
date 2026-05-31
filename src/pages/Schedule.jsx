import React, { useState } from 'react';
import { crm } from '@/services/crm';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Topbar from '@/layouts/Topbar';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { DAYS_OF_WEEK } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function Schedule() {
  const [branchFilter, setBranchFilter] = useState('all');
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [form, setForm] = useState({ schedule: [] });
  const qc = useQueryClient();

  const { data: groups = [], isLoading } = useQuery({ queryKey: ['groups'], queryFn: () => crm.entities.Group.list() });
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => crm.entities.Branch.list() });
  const { data: coaches = [] } = useQuery({ queryKey: ['coaches'], queryFn: () => crm.entities.Coach.list() });
  const { data: students = [] } = useQuery({ queryKey: ['students'], queryFn: () => crm.entities.Student.list('-created_date', 500) });

  const createGroupMutation = useMutation({
    mutationFn: (data) => {
      const branch = branches.find(b => b.id === data.branch_id);
      const coach = coaches.find(c => c.id === data.coach_id);
      return crm.entities.Group.create({
        ...data,
        branch_name: branch?.name, coach_name: coach?.full_name,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups'] }); setShowAddGroup(false); setForm({ schedule: [] }); toast.success('Группа создана'); },
  });

  const filteredGroups = branchFilter === 'all' ? groups : groups.filter(g => g.branch_id === branchFilter);

  const addScheduleSlot = () => {
    setForm({ ...form, schedule: [...(form.schedule || []), { day: 'Пн', time_start: '16:00', time_end: '17:30' }] });
  };

  return (
    <div>
      <Topbar title="Расписание" />
      <div className="p-6 max-w-[1400px]">
        <PageHeader title="Расписание занятий" subtitle={`${filteredGroups.length} групп`}>
          <Button onClick={() => setShowAddGroup(true)} className="gap-1.5 bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Новая группа
          </Button>
        </PageHeader>

        <div className="flex items-center gap-3 mb-6">
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
        ) : filteredGroups.length === 0 ? (
          <EmptyState icon={Calendar} title="Нет групп" description="Создайте первую группу" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGroups.map(group => {
              const groupStudents = students.filter(s => s.group_id === group.id && s.status === 'active');
              return (
                <Card key={group.id} className="rounded-2xl border-border">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">{group.name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{group.branch_name} · {group.coach_name}</p>
                      </div>
                      <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">{group.age_group}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-3">
                      {(group.schedule || []).map((slot, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs font-medium">{slot.day}</span>
                          <span>{slot.time_start} — {slot.time_end}</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {groupStudents.length} учеников{group.max_students ? ` из ${group.max_students}` : ''}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showAddGroup} onOpenChange={setShowAddGroup}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Новая группа</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label className="text-xs">Название *</Label><Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Дети 6-8 лет" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Филиал *</Label>
                <Select value={form.branch_id || ''} onValueChange={v => setForm({ ...form, branch_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Тренер *</Label>
                <Select value={form.coach_id || ''} onValueChange={v => setForm({ ...form, coach_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>{coaches.filter(c => !form.branch_id || c.branch_id === form.branch_id).map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Возрастная группа</Label><Input value={form.age_group || ''} onChange={e => setForm({ ...form, age_group: e.target.value })} placeholder="6-8 лет" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Макс. учеников</Label><Input type="number" value={form.max_students || 25} onChange={e => setForm({ ...form, max_students: Number(e.target.value) })} /></div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs">Расписание</Label>
                <Button variant="outline" size="sm" onClick={addScheduleSlot}>+ Добавить</Button>
              </div>
              {(form.schedule || []).map((slot, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <Select value={slot.day} onValueChange={v => { const s = [...form.schedule]; s[i] = { ...s[i], day: v }; setForm({ ...form, schedule: s }); }}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>{DAYS_OF_WEEK.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="time" value={slot.time_start} onChange={e => { const s = [...form.schedule]; s[i] = { ...s[i], time_start: e.target.value }; setForm({ ...form, schedule: s }); }} className="w-28" />
                  <span className="text-sm">—</span>
                  <Input type="time" value={slot.time_end} onChange={e => { const s = [...form.schedule]; s[i] = { ...s[i], time_end: e.target.value }; setForm({ ...form, schedule: s }); }} className="w-28" />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddGroup(false)}>Отмена</Button>
            <Button onClick={() => createGroupMutation.mutate(form)} disabled={!form.name || !form.branch_id || !form.coach_id} className="bg-primary hover:bg-primary/90">Создать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}