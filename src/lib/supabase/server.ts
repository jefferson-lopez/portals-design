import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

export async function createClient() {
  const { publishableKey, url } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, options, value } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. Middleware refreshes sessions.
        }
      },
    },
  });
}

export function createAccessTokenClient(accessToken: string) {
  const { publishableKey, url } = getSupabaseEnv();
  return createSupabaseClient<Database>(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
