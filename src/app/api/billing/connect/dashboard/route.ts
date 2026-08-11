import { NextResponse } from "next/server";
import { getStripe } from "@/lib/billing/stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  }

  const { data: account } = (await supabase
    .from("creator_stripe_accounts" as never)
    .select("stripe_account_id,onboarding_status")
    .eq("owner_id", userData.user.id)
    .maybeSingle()) as {
    data: {
      onboarding_status: string | null;
      stripe_account_id: string;
    } | null;
  };

  if (!account || account.onboarding_status !== "complete") {
    return NextResponse.json(
      { error: "connect_not_configured" },
      { status: 409 },
    );
  }

  const link = await getStripe().accounts.createLoginLink(
    account.stripe_account_id,
  );
  return NextResponse.json({ url: link.url });
}
