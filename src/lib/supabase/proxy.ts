import { createServerClient } from "@supabase/ssr";
import {
  type NextRequest,
  NextResponse,
  type NextResponse as NextResponseType,
} from "next/server";
import type { Database } from "./database.types";
import { getSupabaseEnv, hasSupabaseEnv } from "./env";

export async function updateSession(
  request: NextRequest,
  response: NextResponseType,
) {
  if (!hasSupabaseEnv()) {
    return response;
  }

  const { publishableKey, url } = getSupabaseEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, options, value } of cookiesToSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedRoute = getProtectedRoute(request.nextUrl.pathname);

  if (!user && protectedRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${protectedRoute.locale}/auth/sign-in`;
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", protectedRoute.next);

    const redirectResponse = NextResponse.redirect(redirectUrl);

    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }

    return redirectResponse;
  }

  return response;
}

function getProtectedRoute(pathname: string) {
  const match = pathname.match(
    /^\/(en|es)(\/home|\/create(?:\/|$)|\/dashboard(?:\/|$))(.*)$/,
  );

  if (!match) {
    return null;
  }

  return {
    locale: match[1],
    next: `/${match[1]}${match[2]}${match[3]}` || `/${match[1]}/home`,
  };
}
