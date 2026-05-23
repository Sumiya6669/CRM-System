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
    return runSupabaseQuery(
      'auth.signInWithPassword',
      getSupabaseClient().auth.signInWithPassword({ email, password })
    );
  },

  async signUp({ email, password, fullName, inviteToken }) {
    return runSupabaseQuery(
      'auth.signUp',
      getSupabaseClient().auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${supabaseEnv.appUrl}/login`,
          data: {
            full_name: fullName,
            invite_token: inviteToken,
          },
        },
      })
    );
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
    return runSupabaseQuery('auth.signOut', getSupabaseClient().auth.signOut());
  },

  onAuthStateChange(callback) {
    return getSupabaseClient().auth.onAuthStateChange(callback);
  },
};
