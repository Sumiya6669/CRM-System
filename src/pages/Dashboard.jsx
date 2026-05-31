import React from 'react';
import { crm } from '@/services/crm';
import { useQuery } from '@tanstack/react-query';
import Topbar from '@/layouts/Topbar';
import StatCard from '@/components/ui/StatCard';
import { formatMoney, formatDate } from '@/lib/constants';
import {
  Users, UserPlus, AlertTriangle, TrendingUp,
  Package, ShoppingCart, Building2, Clock, CalendarCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['students'],
    queryFn: () => crm.entities.Student.list('-created_date', 500),
  });
  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['payments'],
    queryFn: () => crm.entities.Payment.list('-created_date', 500),
  });
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => crm.entities.Branch.list(),
  });
  const { data: sales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => crm.entities.Sale.list('-created_date', 100),
  });
  const { data: stockItems = [] } = useQuery({
    queryKey: ['stockItems'],
    queryFn: () => crm.entities.StockItem.list('-created_date', 500),
  });
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => crm.entities.Product.list(),
  });
  const { data: logs = [] } = useQuery({
    queryKey: ['recentLogs'],
    queryFn: () => crm.entities.ActivityLog.list('-created_date', 10),
  });
  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance'],
    queryFn: () => crm.entities.Attendance.list('-date', 500),
  });

  const isLoading = loadingStudents || loadingPayments;

  const activeStudents = students.filter(s => s.status === 'active');
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const newStudentsThisMonth = students.filter(s => {
    if (!s.start_date) return false;
    return s.start_date.startsWith(thisMonth);
  });

  const monthPayments = payments.filter(p => p.payment_date && p.payment_date.startsWith(thisMonth) && p.status !== 'cancelled');
  const monthRevenue = monthPayments.reduce((s, p) => s + (p.amount || 0), 0);

  const debtStudents = students.filter(s => s.status === 'active' && (s.debt || 0) > 0);
  const totalDebt = debtStudents.reduce((s, st) => s + (st.debt || 0), 0);

  const overduePayments = payments.filter(p => p.status === 'overdue');

  const lowStockProducts = products.filter(p => {
    const totalStock = stockItems.filter(si => si.product_id === p.id).reduce((s, si) => s + (si.quantity || 0), 0);
    return totalStock <= (p.min_stock || 5);
  });

  const monthSalesTotal = sales
    .filter(s => s.sale_date && s.sale_date.startsWith(thisMonth))
    .reduce((sum, s) => sum + (s.total || 0), 0);
  const monthAttendance = attendance.filter(record => record.date?.startsWith(thisMonth));
  const attendanceRate = monthAttendance.length
    ? Math.round((monthAttendance.filter(record => record.present).length / monthAttendance.length) * 100)
    : 0;

  if (isLoading) {
    return (
      <div>
        <Topbar title="Дашборд" />
        <div className="p-6 flex items-center justify-center h-[80vh]">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Topbar title="Дашборд" />
      <div className="p-6 space-y-6 max-w-[1400px]">
        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard label="Активных учеников" value={activeStudents.length} icon={Users} sublabel={`из ${students.length} всего`} />
          <StatCard label="Новые за месяц" value={newStudentsThisMonth.length} icon={UserPlus} trend="+12%" trendUp />
          <StatCard label="Выручка за месяц" value={formatMoney(monthRevenue)} icon={TrendingUp} />
          <StatCard label="Задолженность" value={formatMoney(totalDebt)} icon={AlertTriangle} sublabel={`${debtStudents.length} должников`} />
          <StatCard label="Продажи товаров" value={formatMoney(monthSalesTotal)} icon={ShoppingCart} />
          <StatCard label="Просроченные оплаты" value={overduePayments.length} icon={Clock} />
          <StatCard label="Филиалов" value={branches.length} icon={Building2} />
          <StatCard label="Товаров с низким остатком" value={lowStockProducts.length} icon={Package} />
          <StatCard label="Посещаемость за месяц" value={`${attendanceRate}%`} icon={CalendarCheck} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Requires attention */}
          <Card className="rounded-2xl border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Требует внимания
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {debtStudents.length > 0 && (
                <Link to="/students?filter=debt" className="flex items-center justify-between gap-3 p-3 rounded-xl bg-red-50/60 hover:bg-red-50 transition-colors">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="truncate text-sm font-medium text-red-800">Ученики с долгом</span>
                  </div>
                  <span className="text-sm font-semibold text-red-700">{debtStudents.length}</span>
                </Link>
              )}
              {overduePayments.length > 0 && (
                <Link to="/payments?filter=overdue" className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-50/60 hover:bg-amber-50 transition-colors">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="truncate text-sm font-medium text-amber-800">Просроченные оплаты</span>
                  </div>
                  <span className="text-sm font-semibold text-amber-700">{overduePayments.length}</span>
                </Link>
              )}
              {lowStockProducts.length > 0 && (
                <Link to="/inventory?filter=low" className="flex items-center justify-between gap-3 p-3 rounded-xl bg-blue-50/60 hover:bg-blue-50 transition-colors">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="truncate text-sm font-medium text-blue-800">Низкий остаток товаров</span>
                  </div>
                  <span className="text-sm font-semibold text-blue-700">{lowStockProducts.length}</span>
                </Link>
              )}
              {debtStudents.length === 0 && overduePayments.length === 0 && lowStockProducts.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">Всё в порядке!</p>
              )}
            </CardContent>
          </Card>

          {/* Branch comparison */}
          <Card className="rounded-2xl border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Филиалы
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {branches.map(branch => {
                const branchStudents = activeStudents.filter(s => s.branch_id === branch.id);
                const branchRevenue = monthPayments
                  .filter(p => p.branch_id === branch.id)
                  .reduce((s, p) => s + (p.amount || 0), 0);
                const branchDebt = branchStudents.reduce((s, st) => s + (st.debt || 0), 0);
                return (
                  <Link key={branch.id} to={`/branches/${branch.id}`} className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{branch.name}</div>
                      <div className="text-xs text-muted-foreground">{branch.city} · {branchStudents.length} уч.</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{formatMoney(branchRevenue)}</div>
                      {branchDebt > 0 && <div className="text-xs text-red-500">Долг: {formatMoney(branchDebt)}</div>}
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Recent activity */}
        <Card className="rounded-2xl border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Последние действия
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <div className="min-w-0">
                      <div className="truncate text-sm">{log.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {log.branch_name && `${log.branch_name} · `}
                        {formatDate(log.created_date)}
                      </div>
                    </div>
                  </div>
                  {log.amount && <span className="text-sm font-medium">{formatMoney(log.amount)}</span>}
                </div>
              ))}
              {logs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Нет действий</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
