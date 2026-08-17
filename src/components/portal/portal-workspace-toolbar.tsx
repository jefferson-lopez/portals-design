"use client";

import {
  IconArrowLeft,
  IconExternalLink,
  IconLoader2,
  IconPlus,
  IconSearch,
  IconSortDescending,
  IconSpiral,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";
import { usePortalEditorStore } from "@/lib/portal/editor-store";
import { PORTAL_OPEN_ADD_SECTION_DIALOG_EVENT } from "@/lib/portal/scroll-to-section";
import { SidebarTrigger } from "../ui/sidebar";

function dispatchWorkspaceAction(action: "order" | "publish" | "upload") {
  window.dispatchEvent(new CustomEvent(`portal-workspace:${action}`));
}

function dispatchAddSectionAction() {
  document.dispatchEvent(
    new CustomEvent(PORTAL_OPEN_ADD_SECTION_DIALOG_EVENT, {
      detail: { key: "portal-add-section" },
    }),
  );
}

export function PortalWorkspaceToolbar({
  backHref = "/home",
  contentOnly = false,
  initialHasUnpublishedChanges = true,
  mode = "editor",
  portalId,
  portalSlug,
  searchValue = "",
  onSearchChange,
  searchPlaceholder,
  searchClearLabel,
}: {
  backHref?: string;
  contentOnly?: boolean;
  initialHasUnpublishedChanges?: boolean;
  mode?: "editor" | "home" | "create" | "connect";
  portalId?: string;
  portalSlug?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchClearLabel?: string;
}) {
  const t = useTranslations("PortalEditor");
  const hasUnpublishedChanges = usePortalEditorStore((state) =>
    portalId ? state.hasUnpublishedChangesByPortalId[portalId] : undefined,
  );
  const canPublish = hasUnpublishedChanges ?? initialHasUnpublishedChanges;
  const isHome = mode === "home" || mode === "connect";
  const isCreate = mode === "create";
  const publishingPortalId = usePortalEditorStore(
    (state) => state.publishingPortalId,
  );
  const isPublishing = publishingPortalId === portalId;

  return (
    <>
      <header className="fixed top-2 right-2 left-2 z-40 flex items-center justify-between gap-4 overflow-hidden rounded-3xl border border-border/50 bg-sidebar/70 pl-2 px-4 py-3 backdrop-blur-xl lg:left-[calc(var(--sidebar-offset))]">
        <div className="flex items-center gap-2">
          {!isHome ? (
            <Button
              aria-label={t("workspace.back")}
              className="hidden lg:inline-flex"
              nativeButton={false}
              render={<Link href={backHref} />}
              size="icon"
              variant="ghost"
            >
              <IconArrowLeft />
            </Button>
          ) : null}
          <SidebarTrigger className="lg:hidden" />
        </div>

        <Button
          aria-label={t("workspace.projects")}
          className="absolute left-1/2 hover:bg-transparent -translate-x-1/2 lg:hidden"
          nativeButton={false}
          render={<Link href="/home" />}
          size="icon-lg"
          variant="ghost"
        >
          <IconSpiral className="size-8" />
        </Button>

        <div className="flex items-center justify-end gap-2">
          {contentOnly ? (
            <Button
              aria-label={t("workspace.goToProject")}
              nativeButton={false}
              render={<Link href={backHref} />}
              type="button"
              variant="default"
            >
              {t("workspace.goToProject")}
            </Button>
          ) : isHome ? (
            <Button
              aria-label={t("workspace.createProject")}
              nativeButton={false}
              render={<Link href="/create" />}
              type="button"
              variant="default"
            >
              {t("workspace.createProject")}
            </Button>
          ) : isCreate ? (
            <Button
              aria-label={t("workspace.projects")}
              nativeButton={false}
              render={<Link href="/home" />}
              type="button"
              variant="default"
            >
              {t("workspace.projects")}
            </Button>
          ) : (
            <Button
              disabled={!canPublish || isPublishing}
              onClick={() => dispatchWorkspaceAction("publish")}
              type="button"
              variant="default"
            >
              {isPublishing ? (
                <IconLoader2
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : null}
              {isPublishing
                ? t("workspace.publishing")
                : t("workspace.publish")}
            </Button>
          )}
        </div>
      </header>
      <div aria-hidden="true" className="h-20" />

      {mode === "home" && onSearchChange && searchPlaceholder ? (
        <header className="fixed bottom-6 left-[calc(var(--sidebar-offset)+(100vw-var(--sidebar-offset))/2)] z-50 flex w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 items-center justify-center rounded-3xl border border-border/60 bg-sidebar/70 p-1 shadow-lg backdrop-blur-xl">
          <InputGroup className="border-0 bg-transparent shadow-none ring-0 has-[[data-slot=input-group-control]:focus-visible]:border-0 has-[[data-slot=input-group-control]:focus-visible]:ring-0">
            <InputGroupInput
              aria-label={searchPlaceholder}
              className="border-0 ring-0 focus:border-0 focus:ring-0 focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              value={searchValue}
            />
            <InputGroupAddon className="bg-transparent">
              <IconSearch />
            </InputGroupAddon>
            {searchValue ? (
              <InputGroupAddon align="inline-end" className="bg-transparent">
                <InputGroupButton
                  aria-label={searchClearLabel}
                  className="bg-transparent"
                  onClick={() => onSearchChange("")}
                  size="icon-xs"
                >
                  <IconX />
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
        </header>
      ) : null}

      <header
        className={
          contentOnly || mode !== "editor"
            ? "hidden"
            : "fixed bottom-6 left-[calc(var(--sidebar-offset)+(100vw-var(--sidebar-offset))/2)] z-50 flex w-fit max-w-[calc(100%-2rem)] -translate-x-1/2 items-center justify-center gap-1 overflow-hidden rounded-3xl border border-border/60 bg-sidebar/70 p-2 shadow-lg backdrop-blur-xl"
        }
      >
        <Button
          aria-label={t("workspace.back")}
          className="hidden lg:inline-flex"
          nativeButton={false}
          render={<Link href="/home" />}
          type="button"
          variant="secondary"
        >
          <IconArrowLeft data-icon="inline-start" />
          {t("workspace.back")}
        </Button>
        <Button
          aria-label={t("workspace.back")}
          className="inline-flex lg:hidden"
          nativeButton={false}
          render={<Link href="/home" />}
          size="icon"
          variant="secondary"
        >
          <IconArrowLeft />
        </Button>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger render={<span />}>
              <Button
                aria-label={t("sections.order")}
                onClick={() => dispatchWorkspaceAction("order")}
                size="icon"
                type="button"
                variant="ghost"
              >
                <IconSortDescending />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("sections.order")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<span />}>
              <Button
                aria-label={t("sections.add")}
                onClick={dispatchAddSectionAction}
                size="icon"
                type="button"
                variant="ghost"
              >
                <IconPlus />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("sections.add")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<span />}>
              <Button
                aria-label={t("workspace.openPublished")}
                nativeButton={false}
                render={
                  <Link
                    href={`/p/${encodeURIComponent(portalSlug ?? "")}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  />
                }
                size="icon"
                variant="ghost"
              >
                <IconExternalLink />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("workspace.openPublished")}</TooltipContent>
          </Tooltip>
          <Button
            aria-label={t("ai.addWithAi")}
            className="hidden lg:inline-flex"
            onClick={() => dispatchWorkspaceAction("upload")}
            type="button"
            variant="default"
          >
            <IconUpload data-icon="inline-start" />
            {t("ai.addWithAi")}
          </Button>
          <Button
            aria-label={t("ai.addWithAi")}
            className="inline-flex lg:hidden"
            onClick={() => dispatchWorkspaceAction("upload")}
            size="icon"
            type="button"
            variant="default"
          >
            <IconUpload />
          </Button>
        </div>
      </header>
    </>
  );
}
