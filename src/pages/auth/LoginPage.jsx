import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthCard, { AuthLink } from '@/features/auth/AuthCard';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, authError } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (authError?.type === 'configuration_missing') {
    return <AuthCard title="Нужна настройка Supabase" subtitle={`Заполните: ${authError.missingKeys?.join(', ')}`} />;
  }

  const next = new URLSearchParams(location.search).get('next') || location.state?.from?.pathname || '/';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await signIn(form);
      navigate(next, { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось войти');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Вход в систему"
      subtitle="Используйте email и пароль, выданные администратором клуба."
      footer={
        <>
          Нет аккаунта? <AuthLink to="/register">Зарегистрироваться</AuthLink>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Email</Label>
          <Input
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Пароль</Label>
          <Input
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={isSubmitting} className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90">
          {isSubmitting ? 'Входим...' : 'Войти'}
        </Button>
        <div className="text-center text-sm">
          <AuthLink to="/forgot-password">Забыли пароль?</AuthLink>
        </div>
      </form>
    </AuthCard>
  );
}
