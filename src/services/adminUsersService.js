import { getSupabaseClient, runSupabaseQuery } from '@/lib/supabase';

export const adminUsersService = {
  async invoke(action, payload = {}) {
    return runSupabaseQuery(
      `functions.admin-users.${action}`,
      getSupabaseClient().functions.invoke('admin-users', {
        body: { action, payload },
      })
    );
  },

  createAdmin(payload) {
    return this.invoke('create_admin', payload);
  },

  setStatus(profileId, status) {
    return this.invoke('set_status', { profile_id: profileId, status });
  },

  resetPassword(profileId, password) {
    return this.invoke('reset_password', { profile_id: profileId, password });
  },

  updateAccess(profileId, payload) {
    return this.invoke('update_access', { profile_id: profileId, ...payload });
  },
};
