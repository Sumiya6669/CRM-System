import { createEntityRepositories } from '@/services/supabaseRepository';
import { authService } from '@/services/authService';

export const crm = {
  entities: createEntityRepositories(),
  auth: {
    me: async () => {
      const { user } = await authService.getUser();
      if (!user) {
        throw new Error('User is not authenticated');
      }

      const profile = await authService.getProfile(user.id);
      return {
        ...user,
        ...(profile || {}),
        role: profile?.role || user.app_metadata?.role || 'trainer',
      };
    },
    logout: async (redirectTo = '/login') => {
      await authService.signOut();
      if (redirectTo && typeof window !== 'undefined') {
        window.location.assign(redirectTo);
      }
    },
    redirectToLogin: (redirectTo) => {
      const target = redirectTo ? `/login?next=${encodeURIComponent(redirectTo)}` : '/login';
      window.location.assign(target);
    },
  },
};
