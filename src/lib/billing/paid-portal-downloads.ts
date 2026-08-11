import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function recordPaidPortalDownload({
  assetId,
  kind,
  portalId,
}: {
  assetId?: string;
  kind: "asset" | "export";
  portalId: string;
}) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;
  const { data, error } = await supabase.rpc(
    "record_paid_portal_download" as never,
    {
      target_asset_id: assetId ?? null,
      target_download_kind: kind,
      target_portal_id: portalId,
    } as never,
  );
  return !error && data === true;
}
