import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import AuthCard from '@/features/auth/AuthCard';

export default function UnauthorizedPage() {
  return (
    <AuthCard title="Недостаточно прав" subtitle="У вашей роли нет доступа к этому разделу CRM.">
      <div className="flex justify-center mb-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-100 bg-red-50">
          <ShieldAlert className="h-6 w-6 text-red-500" />
        </div>
      </div>
      <Button asChild className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90">
        <Link to="/">Вернуться на главную</Link>
      </Button>
    </AuthCard>
  );
}
