import { cn } from '@/lib/utils';

const statusClasses = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  present: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  frozen: 'border-amber-200 bg-amber-50 text-amber-700',
  partial: 'border-amber-200 bg-amber-50 text-amber-700',
  overdue: 'border-red-200 bg-red-50 text-red-700',
  debt: 'border-red-200 bg-red-50 text-red-700',
  cancelled: 'border-slate-200 bg-slate-50 text-slate-500',
  archived: 'border-slate-200 bg-slate-50 text-slate-600',
  inactive: 'border-slate-200 bg-slate-50 text-slate-600',
};

export default function StatusBadge({ status = 'inactive', label, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium leading-5 whitespace-nowrap',
        statusClasses[status] || statusClasses.inactive,
        className
      )}
    >
      {label || status}
    </span>
  );
}
