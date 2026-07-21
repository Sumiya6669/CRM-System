import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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

  // Guards against re-entrant calls: prevents onAuthStateChange -> loadCurrentUser -> getSession()
  // (which can itself trigger a token refresh and a new onAuthStateChange event) from looping.
  const isLoadingRef = useRef(false);
  const loadedUserIdRef = useRef(null);

  const loadCurrentUser = useCallback(async (options = {}) => {
    const { forceProfileReload = false } = options;

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

    if (isLoadingRef.current) {
      // Already refreshing auth state; avoid starting a second, overlapping request.
      return null;
    }
    isLoadingRef.current = true;

    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const { session: currentSession } = await authService.getSession();
      setSession(currentSession || null);

      if (!currentSession?.user) {
        loadedUserIdRef.current = null;
        setUser(null);
        setProfile(null);
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
        return null;
      }

      // If we've already loaded the profile for this exact user in this session,
      // skip re-fetching it (e.g. on routine TOKEN_REFRESHED events) to avoid
      // hammering the profiles endpoint on every silent token refresh.
      if (!forceProfileReload && loadedUserIdRef.current === currentSession.user.id) {
        setUser(currentSession.user);
        return currentSession.user;
      }

      const currentProfile = await authService.getProfile(currentSession.user.id);

      if (!currentProfile || currentProfile.status !== 'active') {
        loadedUserIdRef.current = null;
        setUser(currentSession.user);
        setProfile(null);
        setAuthError({ type: 'user_not_registered', message: 'User profile is not active' });
        return currentSession.user;
      }

      loadedUserIdRef.current = currentSession.user.id;
      setUser(currentSession.user);
      setProfile(currentProfile);
      return currentSession.user;
    } catch (error) {
      loadedUserIdRef.current = null;
      setUser(null);
      setProfile(null);
      setAuthError(getAuthError(error));
      return null;
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadCurrentUser();

    if (!supabaseEnv.isConfigured) {
      return undefined;
    }

    const { data } = authService.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);

      if (!nextSession?.user) {
        loadedUserIdRef.current = null;
        setUser(null);
        setProfile(null);
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
        setAuthChecked(true);
        return;
      }

      // TOKEN_REFRESHED just rotates the access token for the same user — no need to
      // re-fetch the profile or flip loading state, which is what was causing repeated
      // refresh/getSession cycles to cascade into each other.
      if (event === 'TOKEN_REFRESHED' && loadedUserIdRef.current === nextSession.user.id) {
        setUser(nextSession.user);
        return;
      }

      loadCurrentUser({ forceProfileReload: event === 'SIGNED_IN' || event === 'USER_UPDATED' });
    });

    return () => data.subscription.unsubscribe();
  }, [loadCurrentUser]);

  const signIn = useCallback(async ({ email, password }) => {
    await authService.signIn(email, password);
    await loadCurrentUser({ forceProfileReload: true });
  }, [loadCurrentUser]);

  const resetPassword = useCallback((email) => authService.resetPassword(email), []);

  const updatePassword = useCallback(async (password) => {
    await authService.updatePassword(password);
    await loadCurrentUser({ forceProfileReload: true });
  }, [loadCurrentUser]);

  const logout = useCallback(async () => {
    await authService.signOut();
    loadedUserIdRef.current = null;
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
