import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function StatCard({ label, value, icon: Icon, sublabel, trend, trendUp }) {
  const TrendIcon = trendUp ? ArrowUpRight : ArrowDownRight;

  return (
    <Card className="rounded-2xl border-border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-foreground">{value}</p>
            {sublabel && <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>}
          </div>
          {Icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
        {trend && (
          <div className={cn('mt-3 inline-flex items-center gap-1 text-xs font-medium', trendUp ? 'text-emerald-600' : 'text-red-600')}>
            <TrendIcon className="h-3.5 w-3.5" />
            {trend}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
