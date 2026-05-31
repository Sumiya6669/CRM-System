import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthCard from '@/features/auth/AuthCard';
import { useAuth } from '@/contexts/AuthContext';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await updatePassword(password);
      navigate('/', { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось обновить пароль');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard title="Новый пароль" subtitle="Введите новый пароль для аккаунта.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Новый пароль</Label>
          <Input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={isSubmitting} className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90">
          {isSubmitting ? 'Сохраняем...' : 'Сохранить пароль'}
        </Button>
      </form>
    </AuthCard>
  );
}
