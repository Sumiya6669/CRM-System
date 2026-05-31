import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthCard, { AuthLink } from '@/features/auth/AuthCard';
import { useAuth } from '@/contexts/AuthContext';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    setIsSubmitting(true);

    try {
      await resetPassword(email);
      setMessage('Ссылка для восстановления отправлена на email.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось отправить ссылку');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard title="Восстановление пароля" subtitle="Мы отправим ссылку для сброса пароля на ваш email.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Email</Label>
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        {message && <p className="text-sm text-emerald-600">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={isSubmitting} className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90">
          {isSubmitting ? 'Отправляем...' : 'Отправить ссылку'}
        </Button>
        <div className="text-center text-sm">
          <AuthLink to="/login">Вернуться ко входу</AuthLink>
        </div>
      </form>
    </AuthCard>
  );
}
