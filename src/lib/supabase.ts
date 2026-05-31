import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

type SupabaseEnvironment = {
  url: string;
  anonKey: string;
  appName: string;
  appEnv: string;
  appUrl: string;
  companyName: string;
  supportEmail: string;
  missingKeys: string[];
  isConfigured: boolean;
};

const getEnvValue = (key: string): string => {
  const value = import.meta.env[key];
  return typeof value === 'string' ? value.trim() : '';
};

export const supabaseEnv: SupabaseEnvironment = {
  url: getEnvValue('VITE_SUPABASE_URL'),
  anonKey: getEnvValue('VITE_SUPABASE_ANON_KEY'),
  appName: getEnvValue('VITE_APP_NAME') || 'Taekwondo CRM',
  appEnv: getEnvValue('VITE_APP_ENV') || 'development',
  appUrl: getEnvValue('VITE_APP_URL') || 'http://localhost:5173',
  companyName: getEnvValue('VITE_COMPANY_NAME'),
  supportEmail: getEnvValue('VITE_SUPPORT_EMAIL'),
  missingKeys: [],
  isConfigured: false,
};

supabaseEnv.missingKeys = [
  ['VITE_SUPABASE_URL', supabaseEnv.url],
  ['VITE_SUPABASE_ANON_KEY', supabaseEnv.anonKey],
]
  .filter(([, value]) => !value)
  .map(([key]) => key);
supabaseEnv.isConfigured = supabaseEnv.missingKeys.length === 0;

export class SupabaseConfigurationError extends Error {
  missingKeys: string[];

  constructor(missingKeys: string[]) {
    super(`Missing Supabase environment variables: ${missingKeys.join(', ')}`);
    this.name = 'SupabaseConfigurationError';
    this.missingKeys = missingKeys;
  }
}

export class SupabaseQueryError extends Error {
  code?: string;
  details?: string;
  hint?: string;

  constructor(message: string, error?: { code?: string; details?: string; hint?: string }) {
    super(message);
    this.name = 'SupabaseQueryError';
    this.code = error?.code;
    this.details = error?.details;
    this.hint = error?.hint;
  }
}

let client: SupabaseClient<Database> | null = null;

export const assertSupabaseConfigured = () => {
  if (!supabaseEnv.isConfigured) {
    throw new SupabaseConfigurationError(supabaseEnv.missingKeys);
  }
};

export const getSupabaseClient = (): SupabaseClient<Database> => {
  assertSupabaseConfigured();

  if (!client) {
    client = createClient<Database>(supabaseEnv.url, supabaseEnv.anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      global: {
        headers: {
          'x-application-name': supabaseEnv.appName,
          'x-application-env': supabaseEnv.appEnv,
        },
      },
    });
  }

  return client;
};

export const runSupabaseQuery = async <T>(
  label: string,
  query: PromiseLike<{ data: T | null; error: { message: string; code?: string; details?: string; hint?: string } | null }>
): Promise<T> => {
  assertSupabaseConfigured();

  try {
    const { data, error } = await query;

    if (error) {
      throw new SupabaseQueryError(`${label}: ${error.message}`, error);
    }

    return data as T;
  } catch (error) {
    if (error instanceof SupabaseQueryError || error instanceof SupabaseConfigurationError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Unknown Supabase connection error';
    throw new SupabaseQueryError(`${label}: ${message}`);
  }
};
