"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSignUpErrorKey } from "@/lib/auth/auth-error";
import { getSignInErrorKey } from "@/lib/auth/sign-in-error";
import { resolveSiteOrigin } from "@/lib/billing/site-origin";
import { createClient } from "@/lib/supabase/server";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getOrigin() {
  return resolveSiteOrigin(
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NODE_ENV,
  );
}

export type AuthActionState = {
  message?: string;
  status: "idle" | "error";
};

export type SignUpActionState = AuthActionState;

export async function signInWithPassword(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const locale = getString(formData, "locale") || "en";
  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const t = await getTranslations({ locale, namespace: "Auth.signIn" });

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const errorKey = getSignInErrorKey(error);

      if (errorKey !== "invalidCredentials") {
        console.error("Password sign-in failed", {
          code: error.code ?? "unknown",
          status: error.status,
        });
      }

      return { message: t(errorKey), status: "error" };
    }
  } catch (error) {
    console.error("Unexpected password sign-in failure", {
      name: error instanceof Error ? error.name : "UnknownError",
    });

    return { message: t("failed"), status: "error" };
  }

  revalidatePath(`/${locale}/home`);
  redirect(`/${locale}/home`);
}

export async function signUpWithPassword(
  _previousState: SignUpActionState,
  formData: FormData,
): Promise<SignUpActionState> {
  const locale = getString(formData, "locale") || "en";
  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const fullName = getString(formData, "full_name");
  const t = await getTranslations({ locale, namespace: "Auth.signUp" });
  let error: { code?: string; message: string; status?: number } | null = null;

  try {
    const supabase = await createClient();
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      console.error("Could not clear the existing session before sign-up", {
        code: signOutError.code ?? "unknown",
        status: signOutError.status,
      });
      return { message: t("failed"), status: "error" };
    }

    ({ error } = await supabase.auth.signUp({
      email,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${getOrigin()}/${locale}/auth/callback`,
      },
      password,
    }));
  } catch (caughtError) {
    console.error("Unexpected password sign-up failure", {
      name: caughtError instanceof Error ? caughtError.name : "UnknownError",
    });
    return { message: t("failed"), status: "error" };
  }

  if (error) {
    const errorKey = getSignUpErrorKey(error);
    if (errorKey !== "emailRateLimit") {
      console.error("Password sign-up failed", {
        code: error.code ?? "unknown",
        status: error.status,
      });
    }
    return { message: t(errorKey), status: "error" };
  }

  redirect(`/${locale}/auth/sign-in?message=check-email`);
}

export async function signOut(formData: FormData) {
  const locale = getString(formData, "locale") || "en";
  const supabase = await createClient();

  await supabase.auth.signOut();

  revalidatePath(`/${locale}`);
  redirect(`/${locale}/auth/sign-in`);
}
