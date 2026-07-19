"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

export async function signInWithPassword(formData: FormData) {
  const locale = getString(formData, "locale") || "en";
  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    actionFailure(error.message);
  }

  revalidatePath(`/${locale}/dashboard`);
  redirect(`/${locale}/dashboard`);
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

export async function signInWithOAuth(formData: FormData) {
  const locale = getString(formData, "locale") || "en";
  const provider = getString(formData, "provider") as "google";
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    options: { redirectTo: `${getOrigin()}/${locale}/auth/callback` },
    provider,
  });

  if (error || !data.url) {
    actionFailure(error?.message ?? "OAuth failed");
  }

  redirect(data.url);
}

export async function signOut(formData: FormData) {
  const locale = getString(formData, "locale") || "en";
  const supabase = await createClient();

  await supabase.auth.signOut();

  revalidatePath(`/${locale}`);
  redirect(`/${locale}/auth/sign-in`);
}
