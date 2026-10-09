import { createClient } from '@supabase/supabase-js';

// Define types for our Supabase tables
export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  repo_url: string | null;
  created_at: string;
}

export interface Scan {
  id: string;
  project_id: string;
  severity_counts: Record<string, number> | null;
  created_at: string;
}

export interface Vulnerability {
  id: string;
  scan_id: string;
  severity: 'low' | 'medium' | 'high';
  file_path: string;
  line_number: number;
  description: string;
  code_snippet: string;
  created_at: string;
}

export interface Patch {
  id: string;
  scan_id: string;
  vulnerability_id: string;
  before_code: string | null;
  after_code: string | null;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  project_id: string;
  event_type: string;
  event_message: string;
  created_at: string;
}

// Validate environment variables
function validateEnvVars(requireServiceRole = false) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
  }
  if (requireServiceRole && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }
}

// Browser-side Supabase client (SAFE - uses ANON_KEY only)
export function supabaseBrowser() {
  validateEnvVars(false);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return supabase;
}

/**
 * SECURITY: Service role client for admin operations (bypasses RLS)
 * 
 * CRITICAL: This client must ONLY be used in:
 * - API routes (app/api/*)
 * - Never in client-side code
 * - Never in browser components
 * - Never with NEXT_PUBLIC_ prefixed variables
 * 
 * @throws {Error} If called with admin=false to encourage proper usage patterns
 */
export function supabaseServiceRole() {
  validateEnvVars(true);

  // SECURITY: Guard against accidental client-side usage
  if (typeof window !== 'undefined') {
    throw new Error(
      'Cannot use service role client on the client side. ' +
      'This client bypasses Row Level Security and must never be accessible to browsers. ' +
      'Use supabaseBrowser() or create a server action instead.'
    );
  }

  return createClient(
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