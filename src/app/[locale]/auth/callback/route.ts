import { redirect } from "next/navigation";
import { type NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? `/${locale}/home`;

  if (!hasSupabaseEnv()) {
    return NextResponse.redirect(
      new URL(`/${locale}/auth/sign-in`, request.url),
    );
  }

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  redirect(next);
}
