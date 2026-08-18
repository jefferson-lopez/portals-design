import type { ReactNode } from "react";
import { AiWorkflowReconciler } from "@/components/portal/ai-workflow-reconciler";
import {
  WorkspaceSidebar,
  WorkspaceSidebarProvider,
} from "@/components/portal/workspace-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = hasSupabaseEnv()
    ? (await (await createClient()).auth.getUser()).data.user
    : null;

  return (
    <WorkspaceSidebarProvider>
      <SidebarProvider>
        <AiWorkflowReconciler />
        <WorkspaceSidebar
          locale={locale}
          user={
            user
              ? {
                  email: user.email ?? "",
                  name:
                    typeof user.user_metadata.full_name === "string" &&
                    user.user_metadata.full_name.trim()
                      ? user.user_metadata.full_name.trim()
                      : (user.email ?? ""),
                }
              : null
          }
        />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </WorkspaceSidebarProvider>
  );
}
