import { useParams } from 'react-router-dom';
import RegisterPage from '@/pages/auth/RegisterPage';

export default function InviteRegistrationPage() {
  const { token } = useParams();

  return <RegisterPage inviteToken={token} />;
}
