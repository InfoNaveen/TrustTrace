import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { cache } from 'react';

/**
 * SECURITY: Runtime guard to prevent server-side code from being imported in client code
 * The service role key would be exposed if this were used client-side
 */
if (typeof window !== 'undefined') {
  throw new Error(
    'SECURITY ERROR: lib/supabase-server.ts must not be imported in client-side code. ' +
    'This module contains the SUPABASE_SERVICE_ROLE_KEY which bypasses all security. ' +
    'Use lib/supabase.ts with ANON_KEY for client-side code instead.'
  );
}

// Validate environment variables
function validateEnvVars(requireServiceRole = false) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
  }
  // SECURITY: Validate service role key is present if needed
  if (requireServiceRole && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY environment variable. ' +
      'This is required for admin operations and must be available in server-side code only.'
    );
  }
}

// Server-side Supabase client with cookie-based auth (for user sessions)
export async function createSupabaseServerClient() {
  validateEnvVars(false);

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

/**
 * SECURITY: Admin client using service role key
 * This client bypasses Row Level Security - use with extreme caution
 * Only use for server-side admin operations that truly need RLS bypass
 */
let adminClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (!adminClient) {
    validateEnvVars(true);
    
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  
  return adminClient;
}

// Get current user from server-side (with cookie-based auth)
export async function getCurrentUserServer() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Cached server client for use in server components (user-scoped)
export const getCachedSupabaseServer = cache(async () => {
  return await createSupabaseServerClient();
});