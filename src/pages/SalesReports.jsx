import React, { useMemo, useState } from 'react';
import { crm } from '@/services/crm';
import { useQuery } from '@tanstack/react-query';
import Topbar from '@/layouts/Topbar';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import { formatMoney, formatDate, PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { Download, ShoppingCart, TrendingUp, Receipt, Package } from 'lucide-react';
import { toast } from 'sonner';
import { downloadExcel } from '@/lib/excel';
import {
  PAYMENT_ORDER,
  buildAnalytics,
  buildMethodSummary,
  buildPivot,
  filterSales,
} from '@/lib/salesReport';

const CHART_COLORS = ['#6b1e3a', '#8b2e52', '#a8405f', '#c4607a', '#df8195', '#3b82f6', '#10b981'];

const methodLabel = (method) => PAYMENT_METHOD_LABELS[method] || method || 'Не указан';

const startOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
};

export default function SalesReports() {
  const [dateFrom, setDateFrom] = useState(startOfMonth);
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [branchFilter, setBranchFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [pivotMode, setPivotMode] = useState('amount');
  const [groupBy, setGroupBy] = useState('day');

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales'], queryFn: () => crm.entities.Sale.list('-sale_date', 2000),
  });
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => crm.entities.Branch.list() });

  /** Продажи за период и филиал. Отменённые и удалённые в отчёт не попадают. */
  const scopedSales = useMemo(
    () => filterSales(sales, { branchId: branchFilter, dateFrom, dateTo }),
    [sales, branchFilter, dateFrom, dateTo]
  );

  const periodLabel = `${formatDate(dateFrom) || '—'} — ${formatDate(dateTo) || '—'}`;
  const branchLabel = branchFilter === 'all'
    ? 'Все филиалы'
    : branches.find((b) => b.id === branchFilter)?.name || '—';

  // ------------------------------------------------------------------
  // Отчёт 1: сводный по видам оплаты
  // ------------------------------------------------------------------
  const pivot = useMemo(() => buildPivot(scopedSales), [scopedSales]);

  const pivotCell = (row, method) => (
    pivotMode === 'amount' ? row.amounts[method] : row.quantities[method]
  );
  const formatPivot = (value) => (pivotMode === 'amount' ? formatMoney(value) : value);

  // ------------------------------------------------------------------
  // Отчёт 2: по выбранному виду оплаты
  // ------------------------------------------------------------------
  const methodSales = useMemo(() => {
    if (methodFilter === 'all') return scopedSales;
    return scopedSales.filter((sale) => (sale.payment_method || '') === methodFilter);
  }, [scopedSales, methodFilter]);

  const methodSummary = useMemo(
    () => buildMethodSummary(scopedSales, methodLabel),
    [scopedSales]
  );

  const methodSalesTotal = methodSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
  const methodSalesQuantity = methodSales.reduce((sum, sale) => sum + (Number(sale.quantity) || 0), 0);

  // ------------------------------------------------------------------
  // Отчёт 3: аналитика
  // ------------------------------------------------------------------
  const analytics = useMemo(
    () => buildAnalytics(scopedSales, { groupBy, labelFor: methodLabel, colors: CHART_COLORS }),
    [scopedSales, groupBy]
  );

  // ------------------------------------------------------------------
  // Выгрузка в Excel
  // ------------------------------------------------------------------
  const meta = [
    ['Период', periodLabel],
    ['Филиал', branchLabel],
    ['Сформирован', new Date().toLocaleString('ru-RU')],
    [],
  ];

  const pivotSheet = () => ({
    name: 'Сводный по оплатам',
    rows: [
      ...meta,
      ['№', 'Наименование', 'Kaspi QR', 'Kaspi', 'Наличные', 'Кол-во', 'Сумма'],
      ...pivot.rows.map((row, index) => [
        index + 1, row.name,
        row.amounts.kaspi_qr, row.amounts.kaspi, row.amounts.cash,
        row.quantity, row.total,
      ]),
      ['', 'ИТОГО',
        pivot.totals.amounts.kaspi_qr, pivot.totals.amounts.kaspi, pivot.totals.amounts.cash,
        pivot.totals.quantity, pivot.totals.total],
      [],
      ['Количество по видам оплаты'],
      ['№', 'Наименование', 'Kaspi QR', 'Kaspi', 'Наличные', 'Кол-во всего'],
      ...pivot.rows.map((row, index) => [
        index + 1, row.name,
        row.quantities.kaspi_qr, row.quantities.kaspi, row.quantities.cash, row.quantity,
      ]),
      ['', 'ИТОГО',
        pivot.totals.quantities.kaspi_qr, pivot.totals.quantities.kaspi,
        pivot.totals.quantities.cash, pivot.totals.quantity],
    ],
  });

  const methodSheet = () => ({
    name: methodFilter === 'all' ? 'По видам оплаты' : methodLabel(methodFilter),
    rows: [
      ...meta,
      ['Вид оплаты', methodFilter === 'all' ? 'Все' : methodLabel(methodFilter)],
      [],
      ['№', 'Дата', 'Наименование', 'Покупатель', 'Филиал', 'Вид оплаты', 'Кол-во', 'Цена', 'Скидка, %', 'Сумма'],
      ...methodSales.map((sale, index) => [
        index + 1,
        sale.sale_date || '',
        sale.product_name || '',
        sale.buyer_name || sale.student_name || '',
        sale.branch_name || '',
        methodLabel(sale.payment_method),
        Number(sale.quantity) || 0,
        Number(sale.unit_price) || 0,
        Number(sale.discount) || 0,
        Number(sale.total) || 0,
      ]),
      ['', '', 'ИТОГО', '', '', '', methodSalesQuantity, '', '', methodSalesTotal],
      [],
      ['Свод по видам оплаты'],
      ['Вид оплаты', 'Продаж', 'Кол-во', 'Сумма', 'Средний чек'],
      ...methodSummary.map((item) => [item.label, item.count, item.quantity, item.amount, item.average]),
      ['ИТОГО',
        methodSummary.reduce((s, i) => s + i.count, 0),
        methodSummary.reduce((s, i) => s + i.quantity, 0),
        methodSummary.reduce((s, i) => s + i.amount, 0),
        ''],
    ],
  });

  const analyticsSheet = () => ({
    name: 'Аналитика',
    rows: [
      ...meta,
      ['Показатель', 'Значение'],
      ['Выручка', analytics.revenue],
      ['Количество продаж', analytics.count],
      ['Продано единиц', analytics.quantity],
      ['Средний чек', analytics.average],
      [],
      ['Структура по видам оплаты'],
      ['Вид оплаты', 'Сумма', 'Доля, %'],
      ...analytics.structure.map((item) => [item.name, item.value, Number(item.share.toFixed(2))]),
      [],
      [groupBy === 'day' ? 'Динамика по дням' : 'Динамика по месяцам'],
      ['Период', 'Kaspi QR', 'Kaspi', 'Наличные', 'Итого'],
      ...analytics.dynamics.map((row) => [row.key, row.kaspi_qr, row.kaspi, row.cash, row.total]),
      [],
      ['Товары по выручке'],
      ['№', 'Наименование', 'Кол-во', 'Сумма'],
      ...analytics.topProducts.map((item, index) => [index + 1, item.name, item.quantity, item.total]),
      [],
      ['По филиалам'],
      ['Филиал', 'Продаж', 'Кол-во', 'Kaspi QR', 'Kaspi', 'Наличные', 'Итого'],
      ...analytics.byBranch.map((item) => [
        item.name, item.count, item.quantity, item.kaspi_qr, item.kaspi, item.cash, item.total,
      ]),
    ],
  });

  const runExport = async (sheets, fileName) => {
    if (!scopedSales.length) {
      toast.error('За выбранный период продаж нет');
      return;
    }
    try {
      await downloadExcel(fileName, sheets);
      toast.success('Файл Excel сформирован');
    } catch (error) {
      toast.error(`Не удалось сформировать файл: ${error.message}`);
    }
  };

  const filters = (
    <div className="flex flex-wrap items-end gap-3 mb-6 p-4 bg-card rounded-2xl border border-border">
      <div className="space-y-1">
        <Label className="text-xs">Дата с</Label>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-40 text-sm" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Дата по</Label>
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-40 text-sm" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Филиал</Label>
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="h-9 w-48 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все филиалы</SelectItem>
            {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => runExport([pivotSheet(), methodSheet(), analyticsSheet()], 'Отчёт-по-продажам')}
      >
        <Download className="w-3.5 h-3.5" /> Скачать все отчёты
      </Button>
    </div>
  );

  return (
    <div>
      <Topbar title="Отчёты по продажам" />
      <div className="p-6 max-w-[1400px]">
        <PageHeader title="Отчёты по продажам" subtitle="Kaspi QR, Kaspi и наличные — раздельно по каждому виду оплаты" />

        {filters}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Выручка за период" value={formatMoney(analytics.revenue)} icon={TrendingUp} />
          <StatCard label="Продаж" value={analytics.count} icon={Receipt} />
          <StatCard label="Продано единиц" value={analytics.quantity} icon={Package} />
          <StatCard label="Средний чек" value={formatMoney(analytics.average)} icon={ShoppingCart} />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
        ) : (
          <Tabs defaultValue="pivot">
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="pivot">Сводный по видам оплаты</TabsTrigger>
              <TabsTrigger value="method">По виду оплаты</TabsTrigger>
              <TabsTrigger value="analytics">Аналитика</TabsTrigger>
            </TabsList>

            {/* ---------- Отчёт 1 ---------- */}
            <TabsContent value="pivot">
              <Card className="rounded-2xl border-border">
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-base">Продажи по видам оплаты</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={pivotMode} onValueChange={setPivotMode}>
                      <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="amount">В колонках: суммы</SelectItem>
                        <SelectItem value="quantity">В колонках: количество</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => runExport([pivotSheet()], 'Сводный-по-видам-оплаты')}>
                      <Download className="w-3.5 h-3.5" /> Excel
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {pivot.rows.length === 0 ? (
                    <EmptyState icon={ShoppingCart} title="Нет продаж за период" />
                  ) : (
                    <div className="overflow-x-auto">
                      <Table className="responsive-card-table">
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="text-xs font-semibold w-12">№</TableHead>
                            <TableHead className="text-xs font-semibold">Наименование</TableHead>
                            <TableHead className="text-xs font-semibold text-right">Kaspi QR</TableHead>
                            <TableHead className="text-xs font-semibold text-right">Kaspi</TableHead>
                            <TableHead className="text-xs font-semibold text-right">Наличные</TableHead>
                            <TableHead className="text-xs font-semibold text-right">Кол-во</TableHead>
                            <TableHead className="text-xs font-semibold text-right">Сумма</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pivot.rows.map((row, index) => (
                            <TableRow key={row.name} className="hover:bg-muted/20">
                              <TableCell data-label="№" className="text-xs text-muted-foreground">{index + 1}</TableCell>
                              <TableCell data-label="Наименование" className="text-sm font-medium">{row.name}</TableCell>
                              <TableCell data-label="Kaspi QR" className="text-sm text-right">{formatPivot(pivotCell(row, 'kaspi_qr'))}</TableCell>
                              <TableCell data-label="Kaspi" className="text-sm text-right">{formatPivot(pivotCell(row, 'kaspi'))}</TableCell>
                              <TableCell data-label="Наличные" className="text-sm text-right">{formatPivot(pivotCell(row, 'cash'))}</TableCell>
                              <TableCell data-label="Кол-во" className="text-sm text-right">{row.quantity}</TableCell>
                              <TableCell data-label="Сумма" className="text-sm text-right font-semibold">{formatMoney(row.total)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/40 font-semibold">
                            <TableCell />
                            <TableCell className="text-sm">ИТОГО</TableCell>
                            <TableCell className="text-sm text-right">{formatPivot(pivotMode === 'amount' ? pivot.totals.amounts.kaspi_qr : pivot.totals.quantities.kaspi_qr)}</TableCell>
                            <TableCell className="text-sm text-right">{formatPivot(pivotMode === 'amount' ? pivot.totals.amounts.kaspi : pivot.totals.quantities.kaspi)}</TableCell>
                            <TableCell className="text-sm text-right">{formatPivot(pivotMode === 'amount' ? pivot.totals.amounts.cash : pivot.totals.quantities.cash)}</TableCell>
                            <TableCell className="text-sm text-right">{pivot.totals.quantity}</TableCell>
                            <TableCell className="text-sm text-right">{formatMoney(pivot.totals.total)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---------- Отчёт 2 ---------- */}
            <TabsContent value="method">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {methodSummary.map((item) => (
                  <Card key={item.method} className="rounded-2xl border-border">
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                      <div className="text-xl font-bold mt-1">{formatMoney(item.amount)}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {item.count} продаж · {item.quantity} шт · средний чек {formatMoney(item.average)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="rounded-2xl border-border">
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-base">Продажи по выбранному виду оплаты</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={methodFilter} onValueChange={setMethodFilter}>
                      <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все виды оплаты</SelectItem>
                        {PAYMENT_ORDER.map((method) => (
                          <SelectItem key={method} value={method}>{methodLabel(method)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => runExport([methodSheet()], 'Продажи-по-виду-оплаты')}>
                      <Download className="w-3.5 h-3.5" /> Excel
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {methodSales.length === 0 ? (
                    <EmptyState icon={ShoppingCart} title="Нет продаж по этому виду оплаты" />
                  ) : (
                    <div className="overflow-x-auto">
                      <Table className="responsive-card-table">
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="text-xs font-semibold w-12">№</TableHead>
                            <TableHead className="text-xs font-semibold">Дата</TableHead>
                            <TableHead className="text-xs font-semibold">Наименование</TableHead>
                            <TableHead className="text-xs font-semibold">Покупатель</TableHead>
                            <TableHead className="text-xs font-semibold">Филиал</TableHead>
                            <TableHead className="text-xs font-semibold">Вид оплаты</TableHead>
                            <TableHead className="text-xs font-semibold text-right">Кол-во</TableHead>
                            <TableHead className="text-xs font-semibold text-right">Сумма</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {methodSales.map((sale, index) => (
                            <TableRow key={sale.id} className="hover:bg-muted/20">
                              <TableCell data-label="№" className="text-xs text-muted-foreground">{index + 1}</TableCell>
                              <TableCell data-label="Дата" className="text-sm">{formatDate(sale.sale_date)}</TableCell>
                              <TableCell data-label="Наименование" className="text-sm font-medium">{sale.product_name || '—'}</TableCell>
                              <TableCell data-label="Покупатель" className="text-sm">{sale.buyer_name || sale.student_name || '—'}</TableCell>
                              <TableCell data-label="Филиал" className="text-sm">{sale.branch_name || '—'}</TableCell>
                              <TableCell data-label="Вид оплаты" className="text-sm">{methodLabel(sale.payment_method)}</TableCell>
                              <TableCell data-label="Кол-во" className="text-sm text-right">{sale.quantity}</TableCell>
                              <TableCell data-label="Сумма" className="text-sm text-right font-semibold">{formatMoney(sale.total)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/40 font-semibold">
                            <TableCell colSpan={6} className="text-sm">ИТОГО</TableCell>
                            <TableCell className="text-sm text-right">{methodSalesQuantity}</TableCell>
                            <TableCell className="text-sm text-right">{formatMoney(methodSalesTotal)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---------- Отчёт 3 ---------- */}
            <TabsContent value="analytics">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <Select value={groupBy} onValueChange={setGroupBy}>
                  <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Динамика по дням</SelectItem>
                    <SelectItem value="month">Динамика по месяцам</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => runExport([analyticsSheet()], 'Аналитика-продаж')}>
                  <Download className="w-3.5 h-3.5" /> Excel
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <Card className="rounded-2xl border-border">
                  <CardHeader><CardTitle className="text-base">Динамика выручки по видам оплаты</CardTitle></CardHeader>
                  <CardContent>
                    {analytics.dynamics.length === 0 ? (
                      <EmptyState icon={TrendingUp} title="Нет данных" />
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={analytics.dynamics}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                          <XAxis dataKey="key" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(value) => formatMoney(value)} />
                          <Legend />
                          <Line type="monotone" dataKey="kaspi_qr" name="Kaspi QR" stroke={CHART_COLORS[0]} strokeWidth={2} />
                          <Line type="monotone" dataKey="kaspi" name="Kaspi" stroke={CHART_COLORS[3]} strokeWidth={2} />
                          <Line type="monotone" dataKey="cash" name="Наличные" stroke={CHART_COLORS[6]} strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-border">
                  <CardHeader><CardTitle className="text-base">Структура по видам оплаты</CardTitle></CardHeader>
                  <CardContent>
                    {analytics.structure.length === 0 ? (
                      <EmptyState icon={Receipt} title="Нет данных" />
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height={230}>
                          <PieChart>
                            <Pie data={analytics.structure} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={false}>
                              {analytics.structure.map((item) => <Cell key={item.name} fill={item.color} />)}
                            </Pie>
                            <Tooltip formatter={(value) => formatMoney(value)} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-1.5">
                          {analytics.structure.map((item) => (
                            <div key={item.name} className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                {item.name}
                              </span>
                              <span className="font-medium">{formatMoney(item.value)} · {item.share.toFixed(1)}%</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-2xl border-border mb-4">
                <CardHeader><CardTitle className="text-base">Товары по выручке</CardTitle></CardHeader>
                <CardContent>
                  {analytics.topProducts.length === 0 ? (
                    <EmptyState icon={Package} title="Нет данных" />
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={analytics.topProducts.slice(0, 10)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(value) => formatMoney(value)} />
                          <Bar dataKey="total" name="Выручка" fill={CHART_COLORS[1]} radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                      <Table className="responsive-card-table mt-4">
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="text-xs font-semibold w-12">№</TableHead>
                            <TableHead className="text-xs font-semibold">Наименование</TableHead>
                            <TableHead className="text-xs font-semibold text-right">Кол-во</TableHead>
                            <TableHead className="text-xs font-semibold text-right">Сумма</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {analytics.topProducts.map((item, index) => (
                            <TableRow key={item.name}>
                              <TableCell data-label="№" className="text-xs text-muted-foreground">{index + 1}</TableCell>
                              <TableCell data-label="Наименование" className="text-sm">{item.name}</TableCell>
                              <TableCell data-label="Кол-во" className="text-sm text-right">{item.quantity}</TableCell>
                              <TableCell data-label="Сумма" className="text-sm text-right font-semibold">{formatMoney(item.total)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border">
                <CardHeader><CardTitle className="text-base">По филиалам</CardTitle></CardHeader>
                <CardContent>
                  {analytics.byBranch.length === 0 ? (
                    <EmptyState icon={ShoppingCart} title="Нет данных" />
                  ) : (
                    <Table className="responsive-card-table">
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="text-xs font-semibold">Филиал</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Продаж</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Кол-во</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Kaspi QR</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Kaspi</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Наличные</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Итого</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analytics.byBranch.map((item) => (
                          <TableRow key={item.name}>
                            <TableCell data-label="Филиал" className="text-sm font-medium">{item.name}</TableCell>
                            <TableCell data-label="Продаж" className="text-sm text-right">{item.count}</TableCell>
                            <TableCell data-label="Кол-во" className="text-sm text-right">{item.quantity}</TableCell>
                            <TableCell data-label="Kaspi QR" className="text-sm text-right">{formatMoney(item.kaspi_qr)}</TableCell>
                            <TableCell data-label="Kaspi" className="text-sm text-right">{formatMoney(item.kaspi)}</TableCell>
                            <TableCell data-label="Наличные" className="text-sm text-right">{formatMoney(item.cash)}</TableCell>
                            <TableCell data-label="Итого" className="text-sm text-right font-semibold">{formatMoney(item.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
