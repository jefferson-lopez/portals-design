"use client";

import type { IconHome } from "@tabler/icons-react";
import {
  IconAdjustmentsFilled,
  IconBrandStripeFilled,
  IconHomeFilled,
  IconLogout,
  IconPlusFilled,
  IconSettingsFilled,
  IconSpiral,
} from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { signOut } from "@/app/[locale]/_actions/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Link, usePathname } from "@/i18n/navigation";

type ProjectMeta = { id: string; name: string };
type WorkspaceSidebarContextValue = {
  project: ProjectMeta | null;
  setProject: (project: ProjectMeta | null) => void;
};

const WorkspaceSidebarContext =
  createContext<WorkspaceSidebarContextValue | null>(null);

export function WorkspaceSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [project, setProject] = useState<ProjectMeta | null>(null);
  const value = useMemo(() => ({ project, setProject }), [project]);
  return (
    <WorkspaceSidebarContext.Provider value={value}>
      {children}
    </WorkspaceSidebarContext.Provider>
  );
}

export function useWorkspaceSidebarTitle() {
  const pathname = usePathname();
  const t = useTranslations("PortalEditor");
  const workspace = useContext(WorkspaceSidebarContext);
  const project = pathname.match(/^\/create\/([^/]+)/);
  return project
    ? (workspace?.project?.name ?? t("workspace.project"))
    : pathname === "/create"
      ? t("workspace.createProject")
      : t("workspace.projects");
}

export function WorkspaceMobileTitle() {
  return (
    <span className="text-sm font-medium">{useWorkspaceSidebarTitle()}</span>
  );
}

export function WorkspaceProjectRegistration({
  project,
}: {
  project: ProjectMeta;
}) {
  const context = useContext(WorkspaceSidebarContext);
  useEffect(() => {
    context?.setProject(project);
    return () => context?.setProject(null);
  }, [context, project]);
  return null;
}

function MenuLink({
  active,
  children,
  href,
  icon: Icon,
}: {
  active?: boolean;
  children: React.ReactNode;
  href: string;
  icon: typeof IconHome;
}) {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        onClick={() => {
          if (isMobile) setOpenMobile(false);
        }}
        render={<Link href={href} />}
      >
        <Icon />
        <span>{children}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function WorkspaceSidebar({ locale }: { locale: string }) {
  const pathname = usePathname();
  const t = useTranslations("PortalEditor");
  const projectMatch = pathname.match(/^\/create\/([^/]+)/);
  const inProject = Boolean(projectMatch?.[1]);
  const title = useWorkspaceSidebarTitle();
  const sidebarHeaderLabel =
    pathname === "/home" ? t("workspace.all") : t("workspace.portal");
  const signOutFormRef = useRef<HTMLFormElement>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);

  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/home" />} size="lg">
              <IconSpiral className="size-8!" />
              <span className="font-semibold">{sidebarHeaderLabel}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {inProject ? (
          <SidebarGroup>
            <SidebarGroupLabel>{t("workspace.project")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <MenuLink
                  active={pathname === "/home"}
                  href="/home"
                  icon={IconHomeFilled}
                >
                  {t("workspace.projects")}
                </MenuLink>
                <MenuLink
                  active={pathname === `/create/${projectMatch?.[1]}`}
                  href={`/create/${projectMatch?.[1]}`}
                  icon={IconSpiral}
                >
                  {title}
                </MenuLink>
                <MenuLink
                  active={pathname === `/create/${projectMatch?.[1]}/settings`}
                  href={`/create/${projectMatch?.[1]}/settings`}
                  icon={IconSettingsFilled}
                >
                  {t("settings.generalTitle")}
                </MenuLink>
                <MenuLink
                  active={pathname === `/create/${projectMatch?.[1]}/usage`}
                  href={`/create/${projectMatch?.[1]}/usage`}
                  icon={IconAdjustmentsFilled}
                >
                  {t("plan.usageTitle")}
                </MenuLink>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel>{t("workspace.workspace")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <MenuLink
                  active={pathname === "/home"}
                  href="/home"
                  icon={IconHomeFilled}
                >
                  {t("workspace.projects")}
                </MenuLink>
                <MenuLink href="/create" icon={IconPlusFilled}>
                  {t("workspace.createProject")}
                </MenuLink>
                <MenuLink href="/stripe-connect" icon={IconBrandStripeFilled}>
                  {t("workspace.connectStripe")}
                </MenuLink>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <form action={signOut} ref={signOutFormRef}>
              <input name="locale" type="hidden" value={locale} />
              <SidebarMenuButton
                render={
                  <Button
                    onClick={() => setSignOutOpen(true)}
                    type="button"
                    variant="ghost"
                  />
                }
              >
                <IconLogout />
                <span>{t("workspace.signOut")}</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <Dialog onOpenChange={setSignOutOpen} open={signOutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("workspace.signOutTitle")}</DialogTitle>
            <DialogDescription>
              {t("workspace.signOutDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("workspace.cancel")}
            </DialogClose>
            <Button
              onClick={() => signOutFormRef.current?.requestSubmit()}
              type="button"
            >
              {t("workspace.signOutConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
