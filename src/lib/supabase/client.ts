"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

export function createClient() {
  const { publishableKey, url } = getSupabaseEnv();

  return createBrowserClient<Database>(url, publishableKey);
}
