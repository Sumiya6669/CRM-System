import React, { useState, useMemo } from 'react';
import { crm } from '@/services/crm';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Topbar from '@/layouts/Topbar';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import PaginationBar from '@/components/ui/PaginationBar';
import { formatMoney, formatDate, getAge, BELT_LABELS, STATUS_LABELS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Users, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/constants/roles';
import OwnerActionsMenu from '@/components/owner/OwnerActionsMenu';
import OwnerDeleteDialog from '@/components/owner/OwnerDeleteDialog';
import { OWNER_RECORD_TYPES, ownerActionsService } from '@/services/ownerActionsService';

export default function Students() {
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [beltFilter, setBeltFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [form, setForm] = useState({});
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const qc = useQueryClient();
  const debouncedSearch = useDebounce(search, 250);
  const { can, canEdit, canDelete } = usePermissions();

  const canWriteStudents = can(PERMISSIONS.STUDENTS_WRITE);
  const canEditStudent = canWriteStudents || canEdit;
  const showActions = canEditStudent || canDelete;

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: () => crm.entities.Student.list('-created_date', 500),
  });
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => crm.entities.Branch.list(),
  });
  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: () => crm.entities.Group.list(),
  });
  const { data: coaches = [] } = useQuery({
    queryKey: ['coaches'],
    queryFn: () => crm.entities.Coach.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editingStudent
      ? crm.entities.Student.update(editingStudent.id, data)
      : crm.entities.Student.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      setShowAddDialog(false);
      setEditingStudent(null);
      setForm({});
      toast.success(editingStudent ? 'Данные ученика обновлены' : 'Ученик добавлен');
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, reason }) => ownerActionsService.softDelete(OWNER_RECORD_TYPES.STUDENT, id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      setStudentToDelete(null);
      toast.success('Ученик перемещён в корзину');
    },
    onError: (error) => toast.error(error.message),
  });

  const filtered = useMemo(() => {
    return students.filter(s => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (branchFilter !== 'all' && s.branch_id !== branchFilter) return false;
      if (beltFilter !== 'all' && s.belt !== beltFilter) return false;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        return (s.full_name || '').toLowerCase().includes(q) ||
          (s.parent_phone || '').includes(q) ||
          (s.student_id || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [students, debouncedSearch, branchFilter, beltFilter, statusFilter]);

  const pagination = usePagination(filtered, 50);

  const openNewStudent = () => {
    setEditingStudent(null);
    setForm({});
    setShowAddDialog(true);
  };

  const openStudentEditor = (student) => {
    setEditingStudent(student);
    setForm({
      full_name: student.full_name || '',
      birth_date: student.birth_date || '',
      gender: student.gender || '',
      branch_id: student.branch_id || '',
      group_id: student.group_id || '',
      coach_id: student.coach_id || '',
      parent_phone: student.parent_phone || '',
      parent_name: student.parent_name || '',
      start_date: student.start_date || '',
      belt: student.belt || '',
      status: student.status || 'active',
      notes: student.notes || '',
    });
    setShowAddDialog(true);
  };

  const handleSave = () => {
    const branch = branches.find(b => b.id === form.branch_id);
    const group = groups.find(g => g.id === form.group_id);
    const coach = coaches.find(c => c.id === form.coach_id);
    const payload = {
      ...form,
      branch_name: branch?.name || '',
      group_name: group?.name || '',
      coach_name: coach?.full_name || '',
    };

    if (editingStudent) {
      saveMutation.mutate(payload);
      return;
    }

    saveMutation.mutate({
      ...payload,
      student_id: 'TKD-' + String(students.length + 1).padStart(4, '0'),
      status: 'active',
      debt: 0,
    });
  };

  return (
    <div>
      <Topbar title="Ученики" />
      <div className="p-6 max-w-[1400px]">
        <PageHeader title="База учеников" subtitle={`${filtered.length} из ${students.length} учеников`}>
          {canWriteStudents && (
            <Button onClick={openNewStudent} className="gap-1.5 bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4" /> Добавить ученика
            </Button>
          )}
        </PageHeader>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Поиск по ФИО, телефону, ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="Филиал" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все филиалы</SelectItem>
              {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={beltFilter} onValueChange={setBeltFilter}>
            <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="Пояс" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все пояса</SelectItem>
              {Object.entries(BELT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="Статус" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="Ученики не найдены" description="Попробуйте изменить фильтры" />
        ) : (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <Table className="responsive-card-table">
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-semibold">ID</TableHead>
                  <TableHead className="text-xs font-semibold">ФИО</TableHead>
                  <TableHead className="text-xs font-semibold">Филиал</TableHead>
                  <TableHead className="text-xs font-semibold">Группа</TableHead>
                  <TableHead className="text-xs font-semibold">Пояс</TableHead>
                  <TableHead className="text-xs font-semibold">Возраст</TableHead>
                  <TableHead className="text-xs font-semibold">Оплачено до</TableHead>
                  <TableHead className="text-xs font-semibold">Долг</TableHead>
                  <TableHead className="text-xs font-semibold">Статус</TableHead>
                  <TableHead className="text-xs font-semibold w-10"></TableHead>
                  {showActions && <TableHead className="w-12"><span className="sr-only">Действия</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedItems.map(s => (
                  <TableRow key={s.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell data-label="ID" className="text-xs text-muted-foreground font-mono">{s.student_id}</TableCell>
                    <TableCell data-label="ФИО">
                      <div className="text-sm font-medium">{s.full_name}</div>
                      {s.parent_phone && <div className="text-xs text-muted-foreground">{s.parent_phone}</div>}
                    </TableCell>
                    <TableCell data-label="Филиал" className="text-sm">{s.branch_name || '—'}</TableCell>
                    <TableCell data-label="Группа" className="text-sm">{s.group_name || '—'}</TableCell>
                    <TableCell data-label="Пояс"><StatusBadge status={s.belt === 'white' ? 'active' : 'active'} label={BELT_LABELS[s.belt] || s.belt} /></TableCell>
                    <TableCell data-label="Возраст" className="text-sm">{getAge(s.birth_date)}</TableCell>
                    <TableCell data-label="Оплачено до" className="text-sm">{formatDate(s.paid_until)}</TableCell>
                    <TableCell data-label="Долг" className="text-sm font-medium">{(s.debt || 0) > 0 ? <span className="text-red-600">{formatMoney(s.debt)}</span> : <span className="text-emerald-600">0 ₸</span>}</TableCell>
                    <TableCell data-label="Статус"><StatusBadge status={s.status} label={STATUS_LABELS[s.status]} /></TableCell>
                    <TableCell data-label="">
                      <Link to={`/students/${s.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="w-3.5 h-3.5" /></Button>
                      </Link>
                    </TableCell>
                    {showActions && (
                      <TableCell data-label="Действия">
                        <OwnerActionsMenu
                          onEdit={canEditStudent ? () => openStudentEditor(s) : undefined}
                          onDelete={canDelete ? () => setStudentToDelete(s) : undefined}
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

      {/* Add dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingStudent ? 'Редактировать ученика' : 'Новый ученик'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">ФИО *</Label>
              <Input value={form.full_name || ''} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Иванов Иван Иванович" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Дата рождения</Label>
                <Input type="date" value={form.birth_date || ''} onChange={e => setForm({ ...form, birth_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Пол</Label>
                <Select value={form.gender || ''} onValueChange={v => setForm({ ...form, gender: v })}>
                  <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Мужской</SelectItem>
                    <SelectItem value="female">Женский</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Филиал *</Label>
              <Select value={form.branch_id || ''} onValueChange={v => setForm({ ...form, branch_id: v })}>
                <SelectTrigger><SelectValue placeholder="Выберите филиал" /></SelectTrigger>
                <SelectContent>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Группа</Label>
                <Select value={form.group_id || ''} onValueChange={v => setForm({ ...form, group_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Группа" /></SelectTrigger>
                  <SelectContent>
                    {groups.filter(g => !form.branch_id || g.branch_id === form.branch_id).map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Тренер</Label>
                <Select value={form.coach_id || ''} onValueChange={v => setForm({ ...form, coach_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Тренер" /></SelectTrigger>
                  <SelectContent>
                    {coaches.filter(c => !form.branch_id || c.branch_id === form.branch_id).map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Телефон родителя</Label>
                <Input value={form.parent_phone || ''} onChange={e => setForm({ ...form, parent_phone: e.target.value })} placeholder="+7 777 123 45 67" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">ФИО родителя</Label>
                <Input value={form.parent_name || ''} onChange={e => setForm({ ...form, parent_name: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Дата начала занятий</Label>
              <Input type="date" value={form.start_date || ''} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Пояс</Label>
                <Select value={form.belt || ''} onValueChange={v => setForm({ ...form, belt: v })}>
                  <SelectTrigger><SelectValue placeholder="Выберите пояс" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(BELT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Статус</Label>
                <Select value={form.status || 'active'} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Комментарий</Label>
              <Textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Отмена</Button>
            <Button onClick={handleSave} disabled={!form.full_name || !form.branch_id || saveMutation.isPending} className="bg-primary hover:bg-primary/90">
              {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OwnerDeleteDialog
        open={Boolean(studentToDelete)}
        onOpenChange={(open) => !open && setStudentToDelete(null)}
        title={studentToDelete?.full_name || 'Ученик'}
        details={[
          `ID: ${studentToDelete?.student_id || '—'}`,
          `Филиал: ${studentToDelete?.branch_name || '—'}`,
          `Долг: ${formatMoney(studentToDelete?.debt || 0)}`,
        ]}
        isPending={deleteMutation.isPending}
        onConfirm={(reason) => deleteMutation.mutate({ id: studentToDelete.id, reason })}
      />
    </div>
  );
}
