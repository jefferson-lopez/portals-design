"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSignInErrorKey } from "@/lib/auth/sign-in-error";
import { createClient } from "@/lib/supabase/server";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getOrigin() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function actionFailure(message: string): never {
  throw new Error(message);
}

export type AuthActionState = {
  message?: string;
  status: "idle" | "error";
};

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

export async function signUpWithPassword(formData: FormData) {
  const locale = getString(formData, "locale") || "en";
  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const fullName = getString(formData, "full_name");
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${getOrigin()}/${locale}/auth/callback`,
    },
    password,
  });

  if (error) {
    actionFailure(error.message);
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
