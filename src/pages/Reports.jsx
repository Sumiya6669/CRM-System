import React, { useState, useMemo } from 'react';
import { crm } from '@/services/crm';
import { useQuery } from '@tanstack/react-query';
import Topbar from '@/layouts/Topbar';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { formatMoney, PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { Users, Package, TrendingUp, AlertTriangle, Download, Filter, FileText } from 'lucide-react';

const CHART_COLORS = ['#6b1e3a', '#8b2e52', '#a8405f', '#c4607a', '#df8195', '#3b82f6', '#10b981'];

function periodLabel(year, month) {
  const m = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
  return `${m[month - 1]} ${year}`;
}

function getLast6Months() {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

export default function Reports() {
  const [branchFilter, setBranchFilter] = useState('all');
  const [periodFrom, setPeriodFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [periodTo, setPeriodTo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const { data: students = [] } = useQuery({ queryKey: ['students'], queryFn: () => crm.entities.Student.list('-created_date', 500) });
  const { data: payments = [] } = useQuery({ queryKey: ['payments'], queryFn: () => crm.entities.Payment.list('-payment_date', 500) });
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => crm.entities.Branch.list() });
  const { data: sales = [] } = useQuery({ queryKey: ['sales'], queryFn: () => crm.entities.Sale.list('-created_date', 500) });
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Filtered payments by branch and period
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (branchFilter !== 'all' && p.branch_id !== branchFilter) return false;
      if (p.payment_date && periodFrom && p.payment_date < periodFrom + '-01') return false;
      if (p.payment_date && periodTo && p.payment_date > periodTo + '-31') return false;
      return p.status !== 'cancelled';
    });
  }, [payments, branchFilter, periodFrom, periodTo]);

  // Revenue by branch
  const revenueByBranch = useMemo(() => {
    return branches.map(b => {
      const revenue = filteredPayments.filter(p => p.branch_id === b.id).reduce((s, p) => s + (p.amount || 0), 0);
      return { name: b.name?.split(' ').slice(-1)[0] || b.name, fullName: b.name, revenue };
    });
  }, [branches, filteredPayments]);

  // Monthly trend
  const monthlyTrend = useMemo(() => {
    const months = getLast6Months();
    return months.map(m => {
      const [y, mo] = m.split('-');
      const rev = payments.filter(p => p.payment_date?.startsWith(m) && p.status !== 'cancelled'
        && (branchFilter === 'all' || p.branch_id === branchFilter)).reduce((s, p) => s + (p.amount || 0), 0);
      const sal = sales.filter(s => s.sale_date?.startsWith(m) && (branchFilter === 'all' || s.branch_id === branchFilter)).reduce((s, sale) => s + (sale.total || 0), 0);
      return { name: periodLabel(y, Number(mo)), revenue: rev, sales: sal };
    });
  }, [payments, sales, branchFilter]);

  // Payment methods
  const paymentMethodData = useMemo(() => {
    const methods = {};
    filteredPayments.forEach(p => {
      const label = PAYMENT_METHOD_LABELS[p.payment_method] || p.payment_method || 'Другое';
      methods[label] = (methods[label] || 0) + (p.amount || 0);
    });
    return Object.entries(methods).map(([name, value]) => ({ name, value }));
  }, [filteredPayments]);

  // Debtors
  const debtors = useMemo(() => {
    return students.filter(s => s.status === 'active' && (s.debt || 0) > 0
      && (branchFilter === 'all' || s.branch_id === branchFilter))
      .sort((a, b) => (b.debt || 0) - (a.debt || 0));
  }, [students, branchFilter]);

  // Students by branch
  const studentsByBranch = useMemo(() => {
    return branches.map(b => ({
      name: b.name?.split(' ').slice(-1)[0] || b.name,
      active: students.filter(s => s.branch_id === b.id && s.status === 'active').length,
      frozen: students.filter(s => s.branch_id === b.id && s.status === 'frozen').length,
      archived: students.filter(s => s.branch_id === b.id && s.status === 'archived').length,
    }));
  }, [branches, students]);

  // OSV (Оборотно-сальдовая ведомость) by student
  const osvData = useMemo(() => {
    const activeStudents = students.filter(s => branchFilter === 'all' || s.branch_id === branchFilter);
    return activeStudents.map(s => {
      const sPay = payments.filter(p => p.student_id === s.id && p.status !== 'cancelled');
      const inRange = sPay.filter(p => {
        if (!p.payment_date) return false;
        if (periodFrom && p.payment_date < periodFrom + '-01') return false;
        if (periodTo && p.payment_date > periodTo + '-31') return false;
        return true;
      });
      const beforeRange = sPay.filter(p => p.payment_date && periodFrom && p.payment_date < periodFrom + '-01');

      const openingBalance = beforeRange.reduce((s, p) => s + (p.amount || 0), 0);
      const debit = inRange.reduce((s, p) => s + (p.amount || 0), 0);
      const credit = (s.debt || 0);
      const closingBalance = openingBalance + debit;

      return {
        id: s.id,
        name: s.full_name,
        branch: s.branch_name,
        openingBalance,
        debit,
        credit: credit > 0 ? credit : 0,
        closingBalance,
      };
    }).filter(r => r.debit > 0 || r.credit > 0).sort((a, b) => b.debit - a.debit);
  }, [students, payments, branchFilter, periodFrom, periodTo]);

  const osvTotals = useMemo(() => ({
    openingBalance: osvData.reduce((s, r) => s + r.openingBalance, 0),
    debit: osvData.reduce((s, r) => s + r.debit, 0),
    credit: osvData.reduce((s, r) => s + r.credit, 0),
    closingBalance: osvData.reduce((s, r) => s + r.closingBalance, 0),
  }), [osvData]);

  const totalRevenue = filteredPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalDebt = debtors.reduce((s, d) => s + (d.debt || 0), 0);
  const totalSales = sales.filter(s => s.sale_date?.startsWith(thisMonth) && (branchFilter === 'all' || s.branch_id === branchFilter)).reduce((s, sale) => s + (sale.total || 0), 0);

  const Filters = () => (
    <div className="flex flex-wrap items-end gap-3 p-4 bg-muted/30 rounded-xl mb-4">
      <div className="space-y-1">
        <Label className="text-xs">Филиал</Label>
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-44 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все филиалы</SelectItem>
            {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Период с</Label>
        <Input type="month" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} className="h-9 text-sm w-36" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">По</Label>
        <Input type="month" value={periodTo} onChange={e => setPeriodTo(e.target.value)} className="h-9 text-sm w-36" />
      </div>
      <Button variant="outline" size="sm" onClick={() => { setBranchFilter('all'); }} className="h-9 gap-1.5">
        <Filter className="w-3.5 h-3.5" /> Сброс
      </Button>
    </div>
  );

  return (
    <div>
      <Topbar title="Отчёты" />
      <div className="p-6 max-w-[1400px]">
        <PageHeader title="Отчёты и аналитика" subtitle="Финансовые отчёты, аналитика по ученикам и складу">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="w-4 h-4" /> Экспорт
          </Button>
        </PageHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Выручка за период" value={formatMoney(totalRevenue)} icon={TrendingUp} />
          <StatCard label="Продажи товаров" value={formatMoney(totalSales)} icon={Package} sublabel="за текущий месяц" />
          <StatCard label="Задолженность" value={formatMoney(totalDebt)} icon={AlertTriangle} sublabel={`${debtors.length} должников`} />
          <StatCard label="Активных учеников" value={students.filter(s => s.status === 'active' && (branchFilter === 'all' || s.branch_id === branchFilter)).length} icon={Users} />
        </div>

        <Tabs defaultValue="revenue">
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="revenue">Выручка</TabsTrigger>
            <TabsTrigger value="osv" className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />ОСВ</TabsTrigger>
            <TabsTrigger value="students">Ученики</TabsTrigger>
            <TabsTrigger value="debtors">Должники</TabsTrigger>
            <TabsTrigger value="sales">Продажи</TabsTrigger>
          </TabsList>

          <TabsContent value="revenue">
            <Filters />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card className="rounded-2xl">
                <CardHeader><CardTitle className="text-base">Выручка по филиалам</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={revenueByBranch}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => (v / 1000) + 'к'} />
                      <Tooltip formatter={(v) => formatMoney(v)} labelFormatter={(l, items) => items?.[0]?.payload?.fullName || l} />
                      <Bar dataKey="revenue" name="Выручка" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader><CardTitle className="text-base">Способы оплаты</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={paymentMethodData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine>
                        {paymentMethodData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => formatMoney(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl">
              <CardHeader><CardTitle className="text-base">Динамика выручки (6 месяцев)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => (v / 1000) + 'к'} />
                    <Tooltip formatter={(v) => formatMoney(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" name="Оплаты" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="sales" name="Продажи товаров" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="osv">
            <Filters />
            <Card className="rounded-2xl">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Оборотно-сальдовая ведомость</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Период: {periodFrom} — {periodTo}{branchFilter !== 'all' ? ` · ${branches.find(b => b.id === branchFilter)?.name}` : ''}</p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5"><Download className="w-3.5 h-3.5" />Excel</Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs font-semibold">Ученик</TableHead>
                        <TableHead className="text-xs font-semibold">Филиал</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Сальдо нач.</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Дебет (оплаты)</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Кредит (долг)</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Сальдо кон.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {osvData.slice(0, 50).map(r => (
                        <TableRow key={r.id} className="hover:bg-muted/20">
                          <TableCell className="text-sm font-medium">{r.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{r.branch}</TableCell>
                          <TableCell className="text-sm text-right">{r.openingBalance > 0 ? formatMoney(r.openingBalance) : '—'}</TableCell>
                          <TableCell className="text-sm text-right font-medium text-emerald-700">{r.debit > 0 ? formatMoney(r.debit) : '—'}</TableCell>
                          <TableCell className="text-sm text-right font-medium text-red-600">{r.credit > 0 ? formatMoney(r.credit) : '—'}</TableCell>
                          <TableCell className="text-sm text-right font-semibold">{formatMoney(r.closingBalance)}</TableCell>
                        </TableRow>
                      ))}
                      {/* Totals row */}
                      <TableRow className="bg-muted/50 font-bold border-t-2 border-border">
                        <TableCell className="text-sm font-bold" colSpan={2}>ИТОГО ({osvData.length} уч.)</TableCell>
                        <TableCell className="text-sm text-right">{formatMoney(osvTotals.openingBalance)}</TableCell>
                        <TableCell className="text-sm text-right text-emerald-700">{formatMoney(osvTotals.debit)}</TableCell>
                        <TableCell className="text-sm text-right text-red-600">{formatMoney(osvTotals.credit)}</TableCell>
                        <TableCell className="text-sm text-right">{formatMoney(osvTotals.closingBalance)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="students">
            <Card className="rounded-2xl">
              <CardHeader><CardTitle className="text-base">Ученики по филиалам</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={studentsByBranch}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="active" name="Активные" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} stackId="a" />
                    <Bar dataKey="frozen" name="Заморожены" fill="#3b82f6" radius={[0, 0, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="debtors">
            <Filters />
            <Card className="rounded-2xl">
              <CardHeader><CardTitle className="text-base">Список должников ({debtors.length}) · Итого: {formatMoney(totalDebt)}</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs font-semibold">Ученик</TableHead>
                      <TableHead className="text-xs font-semibold">Филиал</TableHead>
                      <TableHead className="text-xs font-semibold">Телефон</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Долг</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {debtors.slice(0, 30).map(d => (
                      <TableRow key={d.id} className="hover:bg-muted/20">
                        <TableCell className="text-sm font-medium">{d.full_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{d.branch_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{d.parent_phone || '—'}</TableCell>
                        <TableCell className="text-sm font-bold text-red-600 text-right">{formatMoney(d.debt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sales">
            <Filters />
            <Card className="rounded-2xl">
              <CardHeader><CardTitle className="text-base">Продажи товаров</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs font-semibold">Дата</TableHead>
                      <TableHead className="text-xs font-semibold">Товар</TableHead>
                      <TableHead className="text-xs font-semibold">Покупатель</TableHead>
                      <TableHead className="text-xs font-semibold">Филиал</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Кол-во</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Сумма</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.filter(s => branchFilter === 'all' || s.branch_id === branchFilter).slice(0, 30).map(s => (
                      <TableRow key={s.id} className="hover:bg-muted/20">
                        <TableCell className="text-sm">{s.sale_date}</TableCell>
                        <TableCell className="text-sm font-medium">{s.product_name}</TableCell>
                        <TableCell className="text-sm">{s.student_name || s.buyer_name || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.branch_name}</TableCell>
                        <TableCell className="text-sm text-right">{s.quantity}</TableCell>
                        <TableCell className="text-sm font-bold text-right">{formatMoney(s.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
