import { AlertTriangle } from 'lucide-react';
import AuthCard from '@/features/auth/AuthCard';
import { supabaseEnv } from '@/lib/supabase';

export default function ConfigurationRequiredPage() {
  return (
    <AuthCard
      title="Нужна настройка Supabase"
      subtitle="Приложение собрано, но для работы с реальными данными нужно заполнить переменные окружения."
    >
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-amber-900">Отсутствуют значения:</p>
            <ul className="space-y-1 text-sm text-amber-800">
              {supabaseEnv.missingKeys.map((key) => (
                <li key={key} className="font-mono">{key}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </AuthCard>
  );
}
