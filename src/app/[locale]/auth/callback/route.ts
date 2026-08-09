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
  const requestedNext = requestUrl.searchParams.get("next");
  const next = isSafeNext(requestedNext, locale)
    ? requestedNext
    : `/${locale}/home`;

  if (!hasSupabaseEnv()) {
    return NextResponse.redirect(
      new URL(`/${locale}/auth/sign-in`, request.url),
    );
  }

  if (!code) {
    return redirectToSignIn(request, locale, "confirmation-expired");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Email confirmation exchange failed", {
      code: error.code ?? "unknown",
      status: error.status,
    });
    return redirectToSignIn(request, locale, "confirmation-expired");
  }

  redirect(next);
}

function isSafeNext(
  value: string | null,
  locale: string,
): value is `/${string}` {
  return Boolean(value?.startsWith(`/${locale}/`) && !value.startsWith("//"));
}

function redirectToSignIn(
  request: NextRequest,
  locale: string,
  message: string,
) {
  const url = new URL(`/${locale}/auth/sign-in`, request.url);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}
