import { getSupabaseClient, runSupabaseQuery, supabaseEnv } from '@/lib/supabase';

const profileSelect = '*';

export const authService = {
  async getSession() {
    return runSupabaseQuery('auth.getSession', getSupabaseClient().auth.getSession());
  },

  async getUser() {
    return runSupabaseQuery('auth.getUser', getSupabaseClient().auth.getUser());
  },

  async getProfile(userId) {
    if (!userId) {
      return null;
    }

    return runSupabaseQuery(
      'profiles.getProfile',
      getSupabaseClient().from('profiles').select(profileSelect).eq('id', userId).maybeSingle()
    );
  },

  async signIn(email, password) {
    const result = await runSupabaseQuery(
      'auth.signInWithPassword',
      getSupabaseClient().auth.signInWithPassword({ email, password })
    );
    const profile = await this.getProfile(result.user?.id);
    if (!profile || profile.status !== 'active') {
      await getSupabaseClient().auth.signOut();
      throw new Error('Учетная запись отключена. Обратитесь к Owner.');
    }
    await runSupabaseQuery('functions.auth-events.login', getSupabaseClient().functions.invoke('auth-events', { body: { action: 'login' } }));
    return result;
  },

  async resetPassword(email) {
    return runSupabaseQuery(
      'auth.resetPasswordForEmail',
      getSupabaseClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${supabaseEnv.appUrl}/reset-password`,
      })
    );
  },

  async updatePassword(password) {
    return runSupabaseQuery('auth.updateUser', getSupabaseClient().auth.updateUser({ password }));
  },

  async signOut() {
    try {
      await runSupabaseQuery('functions.auth-events.logout', getSupabaseClient().functions.invoke('auth-events', { body: { action: 'logout' } }));
    } catch {
      // A disabled account must still be able to clear its local session.
    }
    return runSupabaseQuery('auth.signOut', getSupabaseClient().auth.signOut());
  },

  onAuthStateChange(callback) {
    return getSupabaseClient().auth.onAuthStateChange(callback);
  },
};
