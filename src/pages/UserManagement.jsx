import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Power, PowerOff, Save, ShieldCheck, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import Topbar from '@/layouts/Topbar';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { crm } from '@/services/crm';
import { adminUsersService } from '@/services/adminUsersService';
import { formatDate } from '@/lib/constants';

const emptyCreateForm = { slot_number: '', full_name: '', email: '', password: '', branch_id: '' };
const permissionOptions = [
  { key: 'students', label: 'Ученики' },
  { key: 'payments', label: 'Оплаты' },
  { key: 'inventory', label: 'Склад' },
  { key: 'sales', label: 'Продажи' },
  { key: 'attendance', label: 'Посещаемость' },
  { key: 'reports', label: 'Отчеты' },
];

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [resetTarget, setResetTarget] = useState(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [branchDrafts, setBranchDrafts] = useState({});
  const [accessTarget, setAccessTarget] = useState(null);
  const [accessForm, setAccessForm] = useState({ branch_id: 'all', assigned_branch_ids: [], permissions: {} });
  const [showCreate, setShowCreate] = useState(false);

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ['adminSlots'],
    queryFn: () => crm.entities.AdminSlot.list('slot_number', 3),
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ['adminProfiles'],
    queryFn: () => crm.entities.Profile.filter({ role: 'admin' }, 'admin_slot', 3),
  });
  const { data: users = [] } = useQuery({
    queryKey: ['appUsers'],
    queryFn: () => crm.entities.AppUser.list('-created_date', 20),
  });
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => crm.entities.Branch.list(),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['adminSlots'] });
    queryClient.invalidateQueries({ queryKey: ['adminProfiles'] });
    queryClient.invalidateQueries({ queryKey: ['appUsers'] });
  };

  const createMutation = useMutation({
    mutationFn: () => adminUsersService.createAdmin({
      ...createForm,
      slot_number: Number(createForm.slot_number),
      branch_id: createForm.branch_id || null,
      assigned_branch_ids: createForm.branch_id ? [createForm.branch_id] : [],
    }),
    onSuccess: () => {
      refresh();
      setCreateForm(emptyCreateForm);
      setShowCreate(false);
      toast.success('Администратор создан');
    },
    onError: (error) => toast.error(error.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => adminUsersService.setStatus(id, status),
    onSuccess: refresh,
    onError: (error) => toast.error(error.message),
  });

  const passwordMutation = useMutation({
    mutationFn: () => adminUsersService.resetPassword(resetTarget.id, temporaryPassword),
    onSuccess: () => {
      setResetTarget(null);
      setTemporaryPassword('');
      toast.success('Временный пароль обновлен');
    },
    onError: (error) => toast.error(error.message),
  });

  const accessMutation = useMutation({
    mutationFn: ({ id, branchId, assignedBranchIds, permissions }) => adminUsersService.updateAccess(id, {
      branch_id: branchId || null,
      assigned_branch_ids: assignedBranchIds ?? (branchId ? [branchId] : []),
      permissions: permissions || {},
    }),
    onSuccess: () => {
      refresh();
      toast.success('Доступ администратора обновлен');
    },
    onError: (error) => toast.error(error.message),
  });

  const rows = useMemo(() => slots.map((slot) => {
    const profile = profiles.find((item) => item.id === slot.profile_id);
    const appUser = users.find((item) => item.id === slot.profile_id);
    return { slot, profile, appUser };
  }), [profiles, slots, users]);

  const openCreate = (slotNumber) => {
    setCreateForm({ ...emptyCreateForm, slot_number: String(slotNumber) });
    setShowCreate(true);
  };

  const openAccess = (profile) => {
    setAccessTarget(profile);
    setAccessForm({
      branch_id: profile.branch_id || 'all',
      assigned_branch_ids: profile.assigned_branch_ids || [],
      permissions: profile.permissions || {},
    });
  };

  return (
    <div>
      <Topbar title="Пользователи" />
      <div className="p-6 max-w-[1400px]">
        <PageHeader
          title="Администраторы"
          subtitle="Три управляемых Owner-слота. Пароли задаются только как временные и не сохраняются."
        />

        {isLoading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Слоты администраторов не подготовлены" />
        ) : (
          <Card className="rounded-2xl border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Admin 1-3</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="responsive-card-table">
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs font-semibold">Слот</TableHead>
                    <TableHead className="text-xs font-semibold">Пользователь</TableHead>
                    <TableHead className="text-xs font-semibold">Роль</TableHead>
                    <TableHead className="text-xs font-semibold">Филиал</TableHead>
                    <TableHead className="text-xs font-semibold">Последний вход</TableHead>
                    <TableHead className="text-xs font-semibold">Статус</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ slot, profile, appUser }) => {
                    const branchValue = branchDrafts[profile?.id] ?? profile?.branch_id ?? 'all';
                    return (
                      <TableRow key={slot.id} className="hover:bg-muted/20">
                        <TableCell data-label="Слот" className="text-sm font-semibold">{slot.label}</TableCell>
                        <TableCell data-label="Пользователь">
                          {profile ? (
                            <div>
                              <div className="text-sm font-medium">{profile.full_name}</div>
                              <div className="text-xs text-muted-foreground">{profile.email}</div>
                            </div>
                          ) : <span className="text-sm text-muted-foreground">Свободен</span>}
                        </TableCell>
                        <TableCell data-label="Роль" className="text-sm">{profile ? 'Admin' : '—'}</TableCell>
                        <TableCell data-label="Филиал">
                          {profile ? (
                            <div className="flex min-w-[180px] items-center gap-2">
                              <Select value={branchValue} onValueChange={(value) => setBranchDrafts((current) => ({ ...current, [profile.id]: value }))}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">Все филиалы</SelectItem>
                                  {branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              {branchValue !== (profile.branch_id || 'all') && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  title="Сохранить филиал"
                                  onClick={() => accessMutation.mutate({ id: profile.id, branchId: branchValue === 'all' ? '' : branchValue, permissions: profile.permissions })}
                                >
                                  <Save className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell data-label="Последний вход" className="text-sm">{formatDate(profile?.last_login_at || appUser?.last_sign_in_at) || '—'}</TableCell>
                        <TableCell data-label="Статус">
                          {profile ? <StatusBadge status={profile.status} label={profile.status === 'active' ? 'Активен' : 'Отключен'} /> : '—'}
                        </TableCell>
                        <TableCell data-label="Действия">
                          <div className="flex justify-end gap-1.5">
                            {!profile ? (
                              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openCreate(slot.slot_number)}>
                                <UserPlus className="h-3.5 w-3.5" /> Создать
                              </Button>
                            ) : (
                              <>
                                <Button variant="outline" size="icon" className="h-8 w-8" title="Сбросить пароль" onClick={() => setResetTarget(profile)}>
                                  <KeyRound className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="outline" size="icon" className="h-8 w-8" title="Настроить доступ" onClick={() => openAccess(profile)}>
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  title={profile.status === 'active' ? 'Отключить' : 'Активировать'}
                                  onClick={() => statusMutation.mutate({ id: profile.id, status: profile.status === 'active' ? 'inactive' : 'active' })}
                                >
                                  {profile.status === 'active' ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Создать администратора</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label className="text-xs">Слот</Label><Input value={`Admin ${createForm.slot_number}`} disabled /></div>
            <div className="space-y-1.5"><Label className="text-xs">Имя *</Label><Input value={createForm.full_name} onChange={(event) => setCreateForm({ ...createForm, full_name: event.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Email *</Label><Input type="email" value={createForm.email} onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Временный пароль *</Label><Input type="password" autoComplete="new-password" value={createForm.password} onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })} /></div>
            <div className="space-y-1.5">
              <Label className="text-xs">Филиал</Label>
              <Select value={createForm.branch_id || 'all'} onValueChange={(value) => setCreateForm({ ...createForm, branch_id: value === 'all' ? '' : value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все филиалы</SelectItem>
                  {branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Отмена</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!createForm.full_name || !createForm.email || createForm.password.length < 12 || createMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {createMutation.isPending ? 'Создание...' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(resetTarget)} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Сбросить пароль</DialogTitle></DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label className="text-xs">Новый временный пароль *</Label>
            <Input type="password" autoComplete="new-password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>Отмена</Button>
            <Button onClick={() => passwordMutation.mutate()} disabled={temporaryPassword.length < 12 || passwordMutation.isPending} className="bg-primary hover:bg-primary/90">
              Обновить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(accessTarget)} onOpenChange={(open) => !open && setAccessTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Доступ администратора</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Основной филиал</Label>
              <Select value={accessForm.branch_id} onValueChange={(value) => setAccessForm({ ...accessForm, branch_id: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все филиалы</SelectItem>
                  {branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Доступные филиалы</Label>
              {branches.map((branch) => (
                <label key={branch.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={accessForm.assigned_branch_ids.includes(branch.id)}
                    onCheckedChange={(checked) => setAccessForm((current) => ({
                      ...current,
                      assigned_branch_ids: checked
                        ? [...current.assigned_branch_ids, branch.id]
                        : current.assigned_branch_ids.filter((id) => id !== branch.id),
                    }))}
                  />
                  {branch.name}
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Операционные модули</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {permissionOptions.map((option) => (
                  <label key={option.key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={accessForm.permissions[option.key] !== false}
                      onCheckedChange={(checked) => setAccessForm((current) => ({
                        ...current,
                        permissions: { ...current.permissions, [option.key]: Boolean(checked) },
                      }))}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccessTarget(null)}>Отмена</Button>
            <Button
              className="bg-primary hover:bg-primary/90"
              disabled={accessMutation.isPending}
              onClick={() => accessMutation.mutate({
                id: accessTarget.id,
                branchId: accessForm.branch_id === 'all' ? '' : accessForm.branch_id,
                assignedBranchIds: accessForm.assigned_branch_ids,
                permissions: accessForm.permissions,
              })}
            >
              Сохранить доступ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
