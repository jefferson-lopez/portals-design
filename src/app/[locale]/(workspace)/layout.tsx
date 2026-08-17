import type { ReactNode } from "react";
import {
  WorkspaceSidebar,
  WorkspaceSidebarProvider,
} from "@/components/portal/workspace-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <WorkspaceSidebarProvider>
      <SidebarProvider>
        <WorkspaceSidebar locale={locale} />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </WorkspaceSidebarProvider>
  );
}
