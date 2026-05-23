import React from 'react';
import { Shield, Mail, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export default function UserNotRegisteredError() {
  const { logout, appPublicSettings } = useAuth();
  const supportEmail = appPublicSettings?.supportEmail || 'admin@taekwondo.kz';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-primary-foreground font-bold text-xl tracking-tight">TK</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl shadow-xl shadow-slate-200/50 p-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 mb-6 mx-auto">
            <Shield className="w-6 h-6 text-amber-500" />
          </div>

          <h1 className="text-xl font-semibold text-slate-900 text-center mb-2">Доступ ограничен</h1>
          <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
            Ваша учётная запись не зарегистрирована в системе. Обратитесь к администратору для получения доступа.
          </p>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 space-y-2">
            <p className="text-xs font-medium text-slate-600 mb-2">Что можно сделать:</p>
            <div className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
              <p className="text-xs text-slate-500">Убедитесь, что вы вошли с правильным email-адресом</p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
              <p className="text-xs text-slate-500">Запросите доступ у администратора организации</p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
              <p className="text-xs text-slate-500">Проверьте, не устарело ли приглашение</p>
            </div>
          </div>

          <div className="space-y-2.5">
            <Button
              className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-sm font-medium gap-2"
              onClick={() => logout()}
            >
              <RefreshCw className="w-4 h-4" />
              Войти с другим аккаунтом
            </Button>
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl border-slate-200 text-sm text-slate-600 gap-2"
              onClick={() => window.location.href = `mailto:${supportEmail}`}
            >
              <Mail className="w-4 h-4" />
              Написать администратору
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">Taekwondo CRM · Внутренняя система управления</p>
      </div>
    </div>
  );
}
