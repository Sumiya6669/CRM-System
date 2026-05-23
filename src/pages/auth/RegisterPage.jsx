import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthCard, { AuthLink } from '@/features/auth/AuthCard';
import { useAuth } from '@/contexts/AuthContext';

export default function RegisterPage({ inviteToken }) {
  const { signUp } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      await signUp({ ...form, inviteToken });
      setMessage('Регистрация создана. Проверьте email для подтверждения аккаунта.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось зарегистрироваться');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Регистрация"
      subtitle="После регистрации администратор должен назначить роль и доступ к организации."
      footer={
        <>
          Уже есть аккаунт? <AuthLink to="/login">Войти</AuthLink>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">ФИО</Label>
          <Input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Email</Label>
          <Input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Пароль</Label>
          <Input type="password" minLength={8} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required />
        </div>
        {message && <p className="text-sm text-emerald-600">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={isSubmitting} className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90">
          {isSubmitting ? 'Создаём...' : 'Создать аккаунт'}
        </Button>
      </form>
    </AuthCard>
  );
}
