import React from 'react';
import { crm } from '@/services/crm';
import { useQuery } from '@tanstack/react-query';
import Topbar from '@/layouts/Topbar';
import PageHeader from '@/components/ui/PageHeader';
import { formatMoney } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Users, CreditCard, AlertTriangle, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import StatusBadge from '@/components/ui/StatusBadge';

export default function Branches() {
  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches'], queryFn: () => crm.entities.Branch.list(),
  });
  const { data: students = [] } = useQuery({
    queryKey: ['students'], queryFn: () => crm.entities.Student.list('-created_date', 500),
  });
  const { data: payments = [] } = useQuery({
    queryKey: ['payments'], queryFn: () => crm.entities.Payment.list('-payment_date', 500),
  });
  const { data: coaches = [] } = useQuery({
    queryKey: ['coaches'], queryFn: () => crm.entities.Coach.list(),
  });

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  if (isLoading) {
    return <div><Topbar title="Филиалы" /><div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div></div>;
  }

  return (
    <div>
      <Topbar title="Филиалы" />
      <div className="p-6 max-w-[1400px]">
        <PageHeader title="Филиалы сети" subtitle={`${branches.length} филиалов`} />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {branches.map(branch => {
            const branchStudents = students.filter(s => s.branch_id === branch.id && s.status === 'active');
            const branchRevenue = payments
              .filter(p => p.branch_id === branch.id && p.payment_date?.startsWith(thisMonth) && p.status !== 'cancelled')
              .reduce((s, p) => s + (p.amount || 0), 0);
            const branchDebt = branchStudents.reduce((s, st) => s + (st.debt || 0), 0);
            const branchCoaches = coaches.filter(c => c.branch_id === branch.id);

            return (
              <Link key={branch.id} to={`/branches/${branch.id}`}>
                <Card className="rounded-2xl border-border hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-base font-semibold">{branch.name}</h3>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                          <MapPin className="w-3.5 h-3.5" /> {branch.city}
                        </div>
                      </div>
                      <StatusBadge status={branch.status} label={branch.status === 'active' ? 'Активен' : 'Неактивен'} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="w-3.5 h-3.5" /> Ученики</div>
                        <div className="text-lg font-bold">{branchStudents.length}</div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><CreditCard className="w-3.5 h-3.5" /> Выручка</div>
                        <div className="text-lg font-bold">{formatMoney(branchRevenue)}</div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><AlertTriangle className="w-3.5 h-3.5" /> Долг</div>
                        <div className="text-lg font-bold text-red-600">{formatMoney(branchDebt)}</div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Building2 className="w-3.5 h-3.5" /> Тренеры</div>
                        <div className="text-lg font-bold">{branchCoaches.length}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}