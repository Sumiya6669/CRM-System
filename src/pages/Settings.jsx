import React, { useEffect, useMemo, useState } from 'react';
import { crm } from '@/services/crm';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Topbar from '@/layouts/Topbar';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatusBadge from '@/components/ui/StatusBadge';
import { Plus, RotateCcw, Save } from 'lucide-react';
import { formatMoney } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const DEFAULT_ORGANIZATION_FORM = {
  name: '',
  phone: '',
  email: '',
  address: '',
  description: '',
  bin: '',
  logo_url: '',
  primary_color: '#83213f',
  branch_information: '',
  timezone: 'Asia/Almaty',
  currency: 'KZT',
};

const TIMEZONES = ['Asia/Almaty', 'Asia/Qyzylorda', 'Asia/Aqtobe', 'Asia/Atyrau', 'UTC'];
const CURRENCIES = ['KZT', 'USD', 'EUR', 'RUB'];

const normalizeOrganizationForm = (organization) => {
  const settings = organization?.settings || {};

  return {
    name: organization?.name || DEFAULT_ORGANIZATION_FORM.name,
    phone: organization?.phone || DEFAULT_ORGANIZATION_FORM.phone,
    email: organization?.email || DEFAULT_ORGANIZATION_FORM.email,
    address: organization?.address || settings.address || DEFAULT_ORGANIZATION_FORM.address,
    description: organization?.description || settings.description || DEFAULT_ORGANIZATION_FORM.description,
    bin: organization?.bin || DEFAULT_ORGANIZATION_FORM.bin,
    logo_url: organization?.logo_url || settings.logo_url || DEFAULT_ORGANIZATION_FORM.logo_url,
    primary_color: organization?.primary_color || settings.primary_color || DEFAULT_ORGANIZATION_FORM.primary_color,
    branch_information: organization?.branch_information || settings.branch_information || DEFAULT_ORGANIZATION_FORM.branch_information,
    timezone: organization?.timezone || settings.timezone || DEFAULT_ORGANIZATION_FORM.timezone,
    currency: organization?.currency || settings.currency || DEFAULT_ORGANIZATION_FORM.currency,
  };
};

const isValidUrl = (value) => {
  if (!value) return true;

  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
};

const validateOrganizationForm = (form) => {
  const errors = {};

  if (!form.name.trim()) {
    errors.name = 'Укажите название организации';
  }

  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Введите корректный email';
  }

  if (form.logo_url && !isValidUrl(form.logo_url)) {
    errors.logo_url = 'Укажите корректную ссылку на логотип';
  }

  if (!/^#[0-9a-f]{6}$/i.test(form.primary_color)) {
    errors.primary_color = 'Цвет должен быть в формате #83213f';
  }

  if (!form.timezone) {
    errors.timezone = 'Выберите часовой пояс';
  }

  if (!/^[A-Z]{3}$/.test(form.currency)) {
    errors.currency = 'Укажите трехбуквенный код валюты';
  }

  return errors;
};

export default function Settings() {
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);
  const [branchForm, setBranchForm] = useState({});
  const [subForm, setSubForm] = useState({});
  const [organizationForm, setOrganizationForm] = useState(DEFAULT_ORGANIZATION_FORM);
  const [savedOrganizationForm, setSavedOrganizationForm] = useState(DEFAULT_ORGANIZATION_FORM);
  const qc = useQueryClient();
  const { user } = useAuth();
  const organizationId = user?.organization_id;

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => crm.entities.Branch.list(),
  });
  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => crm.entities.Subscription.list(),
  });
  const { data: organization, isLoading: isLoadingOrganization } = useQuery({
    queryKey: ['organization', organizationId],
    enabled: Boolean(user),
    queryFn: async () => {
      if (organizationId) {
        return crm.entities.Organization.getById(organizationId);
      }

      const organizations = await crm.entities.Organization.list();
      return organizations[0] || null;
    },
  });
  const activeOrganizationId = organizationId || organization?.id;

  useEffect(() => {
    if (!organization) return;

    const nextForm = normalizeOrganizationForm(organization);
    setOrganizationForm(nextForm);
    setSavedOrganizationForm(nextForm);
  }, [organization]);

  const organizationErrors = useMemo(() => validateOrganizationForm(organizationForm), [organizationForm]);
  const dirtyFields = useMemo(
    () => Object.keys(DEFAULT_ORGANIZATION_FORM).filter((key) => (organizationForm[key] || '') !== (savedOrganizationForm[key] || '')),
    [organizationForm, savedOrganizationForm]
  );
  const hasOrganizationErrors = Object.keys(organizationErrors).length > 0;
  const isOrganizationDirty = dirtyFields.length > 0;

  const updateOrganizationField = (field, value) => {
    setOrganizationForm((current) => ({ ...current, [field]: value }));
  };

  const resetOrganizationChanges = () => {
    setOrganizationForm(savedOrganizationForm);
  };

  const createBranchMutation = useMutation({
    mutationFn: (data) => crm.entities.Branch.create({ ...data, organization_id: activeOrganizationId, status: 'active' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      setShowAddBranch(false);
      setBranchForm({});
      toast.success('Филиал добавлен');
    },
    onError: (error) => toast.error(error.message || 'Не удалось добавить филиал'),
  });

  const createSubMutation = useMutation({
    mutationFn: (data) => crm.entities.Subscription.create({ ...data, organization_id: activeOrganizationId, status: 'active' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      setShowAddSub(false);
      setSubForm({});
      toast.success('Абонемент добавлен');
    },
    onError: (error) => toast.error(error.message || 'Не удалось добавить абонемент'),
  });

  const updateOrganizationMutation = useMutation({
    mutationFn: async (form) => {
      if (!organization?.id) {
        throw new Error('Организация не найдена');
      }

      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        description: form.description.trim() || null,
        bin: form.bin.trim() || null,
        logo_url: form.logo_url.trim() || null,
        primary_color: form.primary_color,
        branch_information: form.branch_information.trim() || null,
        timezone: form.timezone,
        currency: form.currency,
        settings: {
          ...(organization.settings || {}),
          address: form.address.trim(),
          description: form.description.trim(),
          logo_url: form.logo_url.trim(),
          primary_color: form.primary_color,
          branch_information: form.branch_information.trim(),
          timezone: form.timezone,
          currency: form.currency,
        },
      };

      return crm.entities.Organization.update(organization.id, payload);
    },
    onSuccess: (updatedOrganization) => {
      const nextForm = normalizeOrganizationForm(updatedOrganization);
      setOrganizationForm(nextForm);
      setSavedOrganizationForm(nextForm);
      qc.invalidateQueries({ queryKey: ['organization', organizationId] });
      toast.success('Настройки организации сохранены');
    },
    onError: (error) => toast.error(error.message || 'Не удалось сохранить настройки организации'),
  });

  const handleOrganizationSubmit = (event) => {
    event.preventDefault();

    if (hasOrganizationErrors) {
      toast.error('Проверьте поля формы');
      return;
    }

    updateOrganizationMutation.mutate(organizationForm);
  };

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
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">Филиалы</CardTitle>
                <Button size="sm" onClick={() => setShowAddBranch(true)} className="gap-1 bg-primary hover:bg-primary/90">
                  <Plus className="w-3.5 h-3.5" /> Добавить
                </Button>
              </CardHeader>
              <CardContent>
                <Table className="responsive-card-table">
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
                    {branches.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell data-label="Название" className="text-sm font-medium">{b.name}</TableCell>
                        <TableCell data-label="Город" className="text-sm">{b.city}</TableCell>
                        <TableCell data-label="Адрес" className="text-sm">{b.address || '—'}</TableCell>
                        <TableCell data-label="Телефон" className="text-sm">{b.phone || '—'}</TableCell>
                        <TableCell data-label="Статус"><StatusBadge status={b.status} label={b.status === 'active' ? 'Активен' : 'Неактивен'} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscriptions">
            <Card className="rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">Виды абонементов</CardTitle>
                <Button size="sm" onClick={() => setShowAddSub(true)} className="gap-1 bg-primary hover:bg-primary/90">
                  <Plus className="w-3.5 h-3.5" /> Добавить
                </Button>
              </CardHeader>
              <CardContent>
                <Table className="responsive-card-table">
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
                    {subscriptions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell data-label="Название" className="text-sm font-medium">{s.name}</TableCell>
                        <TableCell data-label="Цена" className="text-sm">{formatMoney(s.price)}</TableCell>
                        <TableCell data-label="Срок" className="text-sm">{s.duration_days}</TableCell>
                        <TableCell data-label="Заморозка" className="text-sm">{s.can_freeze ? `Да (${s.freeze_days_limit} дн.)` : 'Нет'}</TableCell>
                        <TableCell data-label="Статус"><StatusBadge status={s.status} label={s.status === 'active' ? 'Активен' : 'Неактивен'} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="org">
            <Card className="rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">Организация</CardTitle>
                <span className={isOrganizationDirty ? 'text-xs font-medium text-primary' : 'text-xs text-muted-foreground'}>
                  {isOrganizationDirty ? `Несохранённые изменения: ${dirtyFields.length}` : 'Все изменения сохранены'}
                </span>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingOrganization ? (
                  <div className="flex justify-center py-10">
                    <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
                  </div>
                ) : (
                  <form className="space-y-4" onSubmit={handleOrganizationSubmit}>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Название организации *</Label>
                        <Input value={organizationForm.name} onChange={(event) => updateOrganizationField('name', event.target.value)} />
                        {organizationErrors.name && <p className="text-xs text-destructive">{organizationErrors.name}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Телефон</Label>
                        <Input type="tel" value={organizationForm.phone} onChange={(event) => updateOrganizationField('phone', event.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Email</Label>
                        <Input type="email" value={organizationForm.email} onChange={(event) => updateOrganizationField('email', event.target.value)} />
                        {organizationErrors.email && <p className="text-xs text-destructive">{organizationErrors.email}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">BIN/IIN</Label>
                        <Input value={organizationForm.bin} onChange={(event) => updateOrganizationField('bin', event.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Адрес</Label>
                        <Input value={organizationForm.address} onChange={(event) => updateOrganizationField('address', event.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Логотип</Label>
                        <Input type="url" placeholder="https://example.com/logo.png" value={organizationForm.logo_url} onChange={(event) => updateOrganizationField('logo_url', event.target.value)} />
                        {organizationErrors.logo_url && <p className="text-xs text-destructive">{organizationErrors.logo_url}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Основной цвет</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            className="h-10 w-14 shrink-0 p-1"
                            value={/^#[0-9a-f]{6}$/i.test(organizationForm.primary_color) ? organizationForm.primary_color : DEFAULT_ORGANIZATION_FORM.primary_color}
                            onChange={(event) => updateOrganizationField('primary_color', event.target.value)}
                          />
                          <Input value={organizationForm.primary_color} onChange={(event) => updateOrganizationField('primary_color', event.target.value)} />
                        </div>
                        {organizationErrors.primary_color && <p className="text-xs text-destructive">{organizationErrors.primary_color}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Часовой пояс</Label>
                        <Select value={organizationForm.timezone} onValueChange={(value) => updateOrganizationField('timezone', value)}>
                          <SelectTrigger><SelectValue placeholder="Выберите часовой пояс" /></SelectTrigger>
                          <SelectContent>
                            {TIMEZONES.map((timezone) => <SelectItem key={timezone} value={timezone}>{timezone}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Валюта</Label>
                        <Select value={organizationForm.currency} onValueChange={(value) => updateOrganizationField('currency', value)}>
                          <SelectTrigger><SelectValue placeholder="Выберите валюту" /></SelectTrigger>
                          <SelectContent>
                            {CURRENCIES.map((currency) => <SelectItem key={currency} value={currency}>{currency}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {organizationErrors.currency && <p className="text-xs text-destructive">{organizationErrors.currency}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Описание</Label>
                        <Textarea rows={3} value={organizationForm.description} onChange={(event) => updateOrganizationField('description', event.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Информация о филиалах</Label>
                        <Textarea rows={3} value={organizationForm.branch_information} onChange={(event) => updateOrganizationField('branch_information', event.target.value)} />
                      </div>
                    </div>

                    <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                      <Button type="button" variant="outline" onClick={resetOrganizationChanges} disabled={!isOrganizationDirty || updateOrganizationMutation.isPending}>
                        Отмена
                      </Button>
                      <Button type="button" variant="ghost" className="gap-1.5" onClick={resetOrganizationChanges} disabled={!isOrganizationDirty || updateOrganizationMutation.isPending}>
                        <RotateCcw className="w-3.5 h-3.5" /> Сбросить изменения
                      </Button>
                      <Button
                        type="submit"
                        disabled={!isOrganizationDirty || hasOrganizationErrors || updateOrganizationMutation.isPending}
                        className="gap-1.5 bg-primary hover:bg-primary/90"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {updateOrganizationMutation.isPending ? 'Сохранение...' : 'Сохранить изменения'}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showAddBranch} onOpenChange={setShowAddBranch}>
        <DialogContent>
          <DialogHeader><DialogTitle>Новый филиал</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Название *</Label>
              <Input value={branchForm.name || ''} onChange={(event) => setBranchForm({ ...branchForm, name: event.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Город *</Label>
                <Input value={branchForm.city || ''} onChange={(event) => setBranchForm({ ...branchForm, city: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Телефон</Label>
                <Input value={branchForm.phone || ''} onChange={(event) => setBranchForm({ ...branchForm, phone: event.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Адрес</Label>
              <Input value={branchForm.address || ''} onChange={(event) => setBranchForm({ ...branchForm, address: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBranch(false)}>Отмена</Button>
            <Button
              onClick={() => createBranchMutation.mutate(branchForm)}
              disabled={!branchForm.name || !branchForm.city || !activeOrganizationId || createBranchMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {createBranchMutation.isPending ? 'Создание...' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddSub} onOpenChange={setShowAddSub}>
        <DialogContent>
          <DialogHeader><DialogTitle>Новый абонемент</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Название *</Label>
              <Input value={subForm.name || ''} onChange={(event) => setSubForm({ ...subForm, name: event.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Цена *</Label>
                <Input type="number" value={subForm.price || ''} onChange={(event) => setSubForm({ ...subForm, price: Number(event.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Срок (дней) *</Label>
                <Input type="number" value={subForm.duration_days || 30} onChange={(event) => setSubForm({ ...subForm, duration_days: Number(event.target.value) })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSub(false)}>Отмена</Button>
            <Button
              onClick={() => createSubMutation.mutate(subForm)}
              disabled={!subForm.name || !subForm.price || !activeOrganizationId || createSubMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {createSubMutation.isPending ? 'Создание...' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
