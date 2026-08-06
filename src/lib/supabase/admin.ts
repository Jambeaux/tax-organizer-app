import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client — bypasses row level security. Server-side only,
// never import this into a client component.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
