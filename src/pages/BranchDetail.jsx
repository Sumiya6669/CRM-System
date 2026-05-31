import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { crm } from '@/services/crm';
import { useQuery } from '@tanstack/react-query';
import Topbar from '@/layouts/Topbar';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatMoney, BELT_LABELS } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Users, CreditCard, AlertTriangle, Dumbbell, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BranchDetail() {
  const { id } = useParams();

  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => crm.entities.Branch.list() });
  const branch = branches.find(b => b.id === id);
  const { data: students = [] } = useQuery({ queryKey: ['students'], queryFn: () => crm.entities.Student.list('-created_date', 500) });
  const { data: payments = [] } = useQuery({ queryKey: ['payments'], queryFn: () => crm.entities.Payment.list('-payment_date', 500) });
  const { data: coaches = [] } = useQuery({ queryKey: ['coaches'], queryFn: () => crm.entities.Coach.list() });
  const { data: groups = [] } = useQuery({ queryKey: ['groups'], queryFn: () => crm.entities.Group.list() });

  if (!branch) {
    return <div><Topbar title="Филиал" /><div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div></div>;
  }

  const branchStudents = students.filter(s => s.branch_id === id && s.status === 'active');
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const branchPayments = payments.filter(p => p.branch_id === id && p.payment_date?.startsWith(thisMonth) && p.status !== 'cancelled');
  const branchRevenue = branchPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const branchDebt = branchStudents.reduce((s, st) => s + (st.debt || 0), 0);
  const branchCoaches = coaches.filter(c => c.branch_id === id);
  const branchGroups = groups.filter(g => g.branch_id === id);

  return (
    <div>
      <Topbar title={branch.name} />
      <div className="p-6 max-w-[1400px]">
        <Link to="/branches" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Все филиалы
        </Link>

        <div className="mb-6">
          <h2 className="text-xl font-bold">{branch.name}</h2>
          <p className="text-sm text-muted-foreground">{branch.city} · {branch.address}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Учеников" value={branchStudents.length} icon={Users} />
          <StatCard label="Выручка за месяц" value={formatMoney(branchRevenue)} icon={CreditCard} />
          <StatCard label="Задолженность" value={formatMoney(branchDebt)} icon={AlertTriangle} />
          <StatCard label="Тренеров" value={branchCoaches.length} icon={Dumbbell} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="rounded-2xl border-border">
            <CardHeader className="pb-3"><CardTitle className="text-base">Ученики филиала</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs">ФИО</TableHead>
                    <TableHead className="text-xs">Пояс</TableHead>
                    <TableHead className="text-xs">Долг</TableHead>
                    <TableHead className="text-xs w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branchStudents.slice(0, 15).map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm font-medium">{s.full_name}</TableCell>
                      <TableCell className="text-sm">{BELT_LABELS[s.belt] || 'Белый'}</TableCell>
                      <TableCell className="text-sm">{(s.debt || 0) > 0 ? <span className="text-red-600">{formatMoney(s.debt)}</span> : '0 ₸'}</TableCell>
                      <TableCell><Link to={`/students/${s.id}`}><Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="w-3.5 h-3.5" /></Button></Link></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {branchStudents.length > 15 && <p className="text-xs text-muted-foreground text-center py-2">и ещё {branchStudents.length - 15}...</p>}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-2xl border-border">
              <CardHeader className="pb-3"><CardTitle className="text-base">Тренеры</CardTitle></CardHeader>
              <CardContent>
                {branchCoaches.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <div className="text-sm font-medium">{c.full_name}</div>
                      <div className="text-xs text-muted-foreground">{c.belt || ''} · {c.phone}</div>
                    </div>
                    <StatusBadge status={c.status} label={c.status === 'active' ? 'Активен' : 'Неактивен'} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border">
              <CardHeader className="pb-3"><CardTitle className="text-base">Группы</CardTitle></CardHeader>
              <CardContent>
                {branchGroups.map(g => (
                  <div key={g.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <div className="text-sm font-medium">{g.name}</div>
                      <div className="text-xs text-muted-foreground">{g.coach_name} · {g.age_group}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}