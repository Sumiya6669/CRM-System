import React, { useState, useMemo } from 'react';
import { crm } from '@/services/crm';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Topbar from '@/layouts/Topbar';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import PaginationBar from '@/components/ui/PaginationBar';
import { formatDate } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarCheck, CheckCircle2, Percent, Plus, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { usePagination } from '@/hooks/usePagination';

export default function Attendance() {
  const [branchFilter, setBranchFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [coachFilter, setCoachFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showMarkDialog, setShowMarkDialog] = useState(false);
  const [markForm, setMarkForm] = useState({ date: new Date().toISOString().split('T')[0], branch_id: '', group_id: '' });
  const [attendanceList, setAttendanceList] = useState([]);
  const qc = useQueryClient();

  const { data: attendance = [], isLoading } = useQuery({
    queryKey: ['attendance'], queryFn: () => crm.entities.Attendance.list('-date', 500),
  });
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => crm.entities.Branch.list() });
  const { data: groups = [] } = useQuery({ queryKey: ['groups'], queryFn: () => crm.entities.Group.list() });
  const { data: coaches = [] } = useQuery({ queryKey: ['coaches'], queryFn: () => crm.entities.Coach.list() });
  const { data: students = [] } = useQuery({ queryKey: ['students'], queryFn: () => crm.entities.Student.list('-created_date', 500) });

  const bulkCreateMutation = useMutation({
    mutationFn: async (records) => {
      await crm.entities.Attendance.bulkUpsert(records, 'student_id,date');
      await crm.entities.ActivityLog.create({
        action_type: 'attendance_marked',
        description: `Посещаемость: ${records.filter(r => r.present).length}/${records.length} присутствовали`,
        entity_type: 'Attendance',
        branch_id: markForm.branch_id,
        branch_name: branches.find(b => b.id === markForm.branch_id)?.name,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      setShowMarkDialog(false);
      toast.success('Посещаемость отмечена');
    },
  });

  const filtered = useMemo(() => {
    return attendance.filter(a => {
      if (branchFilter !== 'all' && a.branch_id !== branchFilter) return false;
      if (groupFilter !== 'all' && a.group_id !== groupFilter) return false;
      if (coachFilter !== 'all' && a.coach_id !== coachFilter) return false;
      if (dateFilter && a.date !== dateFilter) return false;
      if (statusFilter === 'present' && !a.present) return false;
      if (statusFilter === 'absent' && a.present) return false;
      return true;
    });
  }, [attendance, branchFilter, coachFilter, dateFilter, groupFilter, statusFilter]);

  const startMarkAttendance = () => {
    const groupStudents = students.filter(s =>
      s.status === 'active' &&
      (!markForm.branch_id || s.branch_id === markForm.branch_id) &&
      (!markForm.group_id || s.group_id === markForm.group_id)
    );
    setAttendanceList(groupStudents.map(s => ({ student_id: s.id, student_name: s.full_name, present: true })));
  };

  const handleSaveAttendance = () => {
    const branch = branches.find(b => b.id === markForm.branch_id);
    const group = groups.find(g => g.id === markForm.group_id);
    const coach = coaches.find(c => c.id === group?.coach_id);
    const records = attendanceList.map(a => ({
      student_id: a.student_id, student_name: a.student_name,
      branch_id: markForm.branch_id, branch_name: branch?.name,
      group_id: markForm.group_id, group_name: group?.name,
      coach_id: coach?.id, coach_name: coach?.full_name || group?.coach_name,
      date: markForm.date, present: a.present,
    }));
    bulkCreateMutation.mutate(records);
  };

  const presentCount = filtered.filter(a => a.present).length;
  const totalCount = filtered.length;
  const rate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
  const monthPrefix = new Date().toISOString().slice(0, 7);
  const monthRecords = attendance.filter((record) => record.date?.startsWith(monthPrefix));
  const monthRate = monthRecords.length ? Math.round((monthRecords.filter((record) => record.present).length / monthRecords.length) * 100) : 0;
  const groupStats = groups.map((group) => {
    const records = monthRecords.filter((record) => record.group_id === group.id);
    return {
      ...group,
      total: records.length,
      rate: records.length ? Math.round((records.filter((record) => record.present).length / records.length) * 100) : 0,
    };
  });
  const pagination = usePagination(filtered, 50);

  return (
    <div>
      <Topbar title="Посещаемость" />
      <div className="p-6 max-w-[1400px]">
        <PageHeader title="Посещаемость" subtitle={`${rate}% общая посещаемость · ${presentCount}/${totalCount} записей`}>
          <Button onClick={() => setShowMarkDialog(true)} className="gap-1.5 bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Отметить посещение
          </Button>
        </PageHeader>

        <div className="grid grid-cols-1 gap-3 mb-6 sm:grid-cols-3">
          <Card className="rounded-2xl border-border"><CardContent className="flex items-center gap-3 p-4"><CheckCircle2 className="h-5 w-5 text-primary" /><div><div className="text-xs text-muted-foreground">Присутствовали</div><div className="text-xl font-semibold">{presentCount}</div></div></CardContent></Card>
          <Card className="rounded-2xl border-border"><CardContent className="flex items-center gap-3 p-4"><UserX className="h-5 w-5 text-primary" /><div><div className="text-xs text-muted-foreground">Пропуски</div><div className="text-xl font-semibold">{Math.max(totalCount - presentCount, 0)}</div></div></CardContent></Card>
          <Card className="rounded-2xl border-border"><CardContent className="flex items-center gap-3 p-4"><Percent className="h-5 w-5 text-primary" /><div><div className="text-xs text-muted-foreground">За текущий месяц</div><div className="text-xl font-semibold">{monthRate}%</div></div></CardContent></Card>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="Филиал" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все филиалы</SelectItem>
              {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={coachFilter} onValueChange={setCoachFilter}>
            <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="Тренер" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все тренеры</SelectItem>
              {coaches.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="Статус" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="present">Присутствовали</SelectItem>
              <SelectItem value="absent">Пропуски</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="h-9 w-44 text-sm" />
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="Группа" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все группы</SelectItem>
              {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="Нет записей посещаемости" />
        ) : (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <Table className="responsive-card-table">
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-semibold">Дата</TableHead>
                  <TableHead className="text-xs font-semibold">Ученик</TableHead>
                  <TableHead className="text-xs font-semibold">Филиал</TableHead>
                  <TableHead className="text-xs font-semibold">Группа</TableHead>
                  <TableHead className="text-xs font-semibold">Статус</TableHead>
                  <TableHead className="text-xs font-semibold">Комментарий</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedItems.map(a => (
                  <TableRow key={a.id} className="hover:bg-muted/20">
                    <TableCell data-label="Дата" className="text-sm">{formatDate(a.date)}</TableCell>
                    <TableCell data-label="Ученик" className="text-sm font-medium">{a.student_name}</TableCell>
                    <TableCell data-label="Филиал" className="text-sm">{a.branch_name}</TableCell>
                    <TableCell data-label="Группа" className="text-sm">{a.group_name || '—'}</TableCell>
                    <TableCell data-label="Статус"><StatusBadge status={a.present ? 'active' : 'archived'} label={a.present ? 'Присутствовал' : 'Пропуск'} /></TableCell>
                    <TableCell data-label="Комментарий" className="text-sm text-muted-foreground">{a.comment || ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationBar {...pagination} onPrevious={pagination.previousPage} onNext={pagination.nextPage} />
          </div>
        )}

        <Card className="mt-6 rounded-2xl border-border">
          <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Статистика групп за месяц</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {groupStats.map((group) => (
              <div key={group.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                <div><div className="text-sm font-medium">{group.name}</div><div className="text-xs text-muted-foreground">{group.total} отметок</div></div>
                <span className="text-sm font-semibold text-primary">{group.rate}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showMarkDialog} onOpenChange={setShowMarkDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Отметить посещение</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label className="text-xs">Дата</Label><Input type="date" value={markForm.date} onChange={e => setMarkForm({ ...markForm, date: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Филиал</Label>
                <Select value={markForm.branch_id} onValueChange={v => setMarkForm({ ...markForm, branch_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Группа</Label>
                <Select value={markForm.group_id} onValueChange={v => setMarkForm({ ...markForm, group_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>{groups.filter(g => !markForm.branch_id || g.branch_id === markForm.branch_id).map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button variant="outline" onClick={startMarkAttendance} className="w-full">Загрузить список учеников</Button>

            {attendanceList.length > 0 && (
              <div className="space-y-2 border rounded-xl p-3">
                {attendanceList.map((a, i) => (
                  <div key={a.student_id} className="flex items-center justify-between py-1">
                    <span className="text-sm">{a.student_name}</span>
                    <Checkbox checked={a.present} onCheckedChange={checked => {
                      const list = [...attendanceList];
                      list[i] = { ...list[i], present: !!checked };
                      setAttendanceList(list);
                    }} />
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMarkDialog(false)}>Отмена</Button>
            <Button onClick={handleSaveAttendance} disabled={attendanceList.length === 0 || bulkCreateMutation.isPending} className="bg-primary hover:bg-primary/90">Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
