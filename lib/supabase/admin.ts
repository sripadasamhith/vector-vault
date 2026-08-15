// SERVER ONLY. Single permitted importer: app/api/shared/[token]/route.ts.
// This client uses the service-role key and bypasses RLS entirely. It exists
// solely to serve share-link reads (ARCHITECTURE.md §6). If you find yourself
// importing this from anywhere else, the share-link design has been
// misunderstood — stop and re-read ARCHITECTURE.md §6 rather than widening
// access from here.
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createSupabaseClient(
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
