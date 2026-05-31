import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/authService';
import { SupabaseConfigurationError, supabaseEnv } from '@/lib/supabase';
import { normalizeRole } from '@/lib/permissions';

const AuthContext = createContext(null);

const getAuthError = (error) => {
  if (error instanceof SupabaseConfigurationError) {
    return {
      type: 'configuration_missing',
      message: error.message,
      missingKeys: error.missingKeys,
    };
  }

  return {
    type: 'unknown',
    message: error instanceof Error ? error.message : 'Unexpected auth error',
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const loadCurrentUser = useCallback(async () => {
    if (!supabaseEnv.isConfigured) {
      setAuthError({
        type: 'configuration_missing',
        message: 'Supabase environment variables are missing',
        missingKeys: supabaseEnv.missingKeys,
      });
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return null;
    }

    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const { session: currentSession } = await authService.getSession();
      setSession(currentSession || null);

      if (!currentSession?.user) {
        setUser(null);
        setProfile(null);
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
        return null;
      }

      const currentProfile = await authService.getProfile(currentSession.user.id);

      if (!currentProfile || currentProfile.status !== 'active') {
        setUser(currentSession.user);
        setProfile(null);
        setAuthError({ type: 'user_not_registered', message: 'User profile is not active' });
        return currentSession.user;
      }

      setUser(currentSession.user);
      setProfile(currentProfile);
      return currentSession.user;
    } catch (error) {
      setUser(null);
      setProfile(null);
      setAuthError(getAuthError(error));
      return null;
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    loadCurrentUser();

    if (!supabaseEnv.isConfigured) {
      return undefined;
    }

    const { data } = authService.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession?.user) {
        setUser(null);
        setProfile(null);
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
        setAuthChecked(true);
        return;
      }

      loadCurrentUser();
    });

    return () => data.subscription.unsubscribe();
  }, [loadCurrentUser]);

  const signIn = useCallback(async ({ email, password }) => {
    await authService.signIn(email, password);
    await loadCurrentUser();
  }, [loadCurrentUser]);

  const resetPassword = useCallback((email) => authService.resetPassword(email), []);

  const updatePassword = useCallback(async (password) => {
    await authService.updatePassword(password);
    await loadCurrentUser();
  }, [loadCurrentUser]);

  const logout = useCallback(async () => {
    await authService.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    setAuthError({ type: 'auth_required', message: 'Authentication required' });
  }, []);

  const value = useMemo(() => {
    const role = normalizeRole(profile?.role || user?.app_metadata?.role);

    return {
      user: profile ? { ...user, ...profile, role } : user,
      authUser: user,
      profile,
      role,
      session,
      isAuthenticated: Boolean(session?.user && profile),
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      authChecked,
      appPublicSettings: {
        name: supabaseEnv.appName,
        env: supabaseEnv.appEnv,
        companyName: supabaseEnv.companyName,
        supportEmail: supabaseEnv.supportEmail,
      },
      signIn,
      resetPassword,
      updatePassword,
      logout,
      checkUserAuth: loadCurrentUser,
      checkAppState: loadCurrentUser,
      navigateToLogin: () => {},
    };
  }, [
    authChecked,
    authError,
    isLoadingAuth,
    loadCurrentUser,
    logout,
    profile,
    resetPassword,
    session,
    signIn,
    updatePassword,
    user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const useAuthRedirect = () => {
  const navigate = useNavigate();

  return useCallback((fallback = '/login') => {
    const next = `${window.location.pathname}${window.location.search}`;
    navigate(`${fallback}?next=${encodeURIComponent(next)}`, { replace: true });
  }, [navigate]);
};
