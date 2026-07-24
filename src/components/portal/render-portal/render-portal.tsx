"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useTransition } from "react";
import {
  updatePortalDocument,
  updatePortalSummary,
} from "@/app/[locale]/_actions/portals";
import {
  SectionActionToolbar,
  SectionContentEditor,
  SectionTypeDialog,
} from "@/components/portal/portal-workspace-controls";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createPortalSection,
  hasPublicSectionContent,
  type PortalDocument,
  type PortalSection,
  type PortalSectionType,
} from "@/lib/portal/document";
import { usePortalEditorStore } from "@/lib/portal/editor-store";
import {
  focusPortalSectionTitle,
  scrollToPortalSection,
} from "@/lib/portal/scroll-to-section";
import { cn } from "@/lib/utils";
import {
  PortalActionButtons,
  PortalActionTriggerButton,
  PortalGlobalActionsOverlay,
  PortalSectionActionsToolbar,
} from "./portal-actions";
import { PortalSectionVisual } from "./portal-section-visuals";
import { PortalShell } from "./portal-shell";
import type {
  PortalAction,
  PortalPublicActionConfig,
  PortalRenderActions,
  RenderPortalProps,
} from "./types";

function compactActions(actions: PortalAction[] | undefined) {
  return (actions ?? []).filter(Boolean);
}

function reindex<T extends { position: number }>(items: T[]) {
  return items.map((item, index) => ({ ...item, position: index }));
}

function uniqueForRender<T extends { id: string; position: number }>(
  items: T[],
  prefix: string,
) {
  const seen = new Set<string>();

  return items.map((item, index) => {
    const id = item.id && !seen.has(item.id) ? item.id : `${prefix}_${index}`;
    seen.add(id);
    return { ...item, id, position: index };
  });
}

function itemDownloadHref(slug: string, itemId: string) {
  return `/api/portals/${encodeURIComponent(slug)}/assets/${encodeURIComponent(itemId)}`;
}

function sectionExportHref(slug: string, sectionId: string) {
  const params = new URLSearchParams({ section: sectionId });
  return `/api/portals/${encodeURIComponent(slug)}/export?${params.toString()}`;
}

function fontFamilyExportHref(
  slug: string,
  sectionId: string,
  fontFamily: string,
) {
  const params = new URLSearchParams({ fontFamily, section: sectionId });
  return `/api/portals/${encodeURIComponent(slug)}/export?${params.toString()}`;
}

function hasDownloadReference(value: {
  file_url?: string;
  storage_path?: string;
}) {
  return Boolean(value.storage_path || value.file_url);
}

function buildPublicActions({
  copy,
  slots,
  slug,
}: PortalPublicActionConfig & {
  copy: {
    copied: string;
    copyColor: (color: string) => string;
    downloadFile: (name: string) => string;
    downloadFont: (name: string) => string;
    downloadImage: (name: string) => string;
    downloadSection: (name: string) => string;
    exportAll: string;
    imageFallback: string;
    sectionType: (type: PortalSectionType) => string;
  };
}): PortalRenderActions {
  return {
    color: ({ item }) =>
      slots.item?.color?.copy
        ? [
            {
              feedbackLabel: copy.copied,
              icon: "copy",
              id: `copy-${item.id}`,
              label: copy.copyColor(item.color_code),
              onClick: () => copyText(item.color_code),
            },
          ]
        : [],
    file: ({ item }) =>
      slots.item?.file?.download &&
      item.allow_download &&
      hasDownloadReference(item)
        ? [
            {
              download: true,
              href: itemDownloadHref(slug, item.id),
              icon: "download",
              id: `download-${item.id}`,
              label: copy.downloadFile(item.file_name),
            },
          ]
        : [],
    font: ({ item, section }) =>
      slots.item?.font?.download &&
      section.allow_download &&
      hasDownloadReference(item)
        ? [
            {
              download: true,
              href: fontFamilyExportHref(slug, section.id, item.font_name),
              icon: "download",
              id: `download-font-family-${section.id}-${item.font_name}`,
              label: copy.downloadFont(item.font_name),
            },
          ]
        : [],
    global: () =>
      slots.global?.exportAssets
        ? [
            {
              download: true,
              href: `/api/portals/${encodeURIComponent(slug)}/export`,
              icon: "export",
              id: "export-all",
              label: copy.exportAll,
              size: "icon-lg",
              variant: "ghost",
            },
          ]
        : [],
    image: ({ item, section }) =>
      slots.item?.image?.download &&
      section.allow_download &&
      item.allow_download
        ? [
            {
              download: true,
              href: itemDownloadHref(slug, item.id),
              icon: "download",
              id: `download-${item.id}`,
              label: copy.downloadImage(item.alt_text || copy.imageFallback),
            },
          ]
        : [],
    section: (section) => {
      return slots.section?.download &&
        section.allow_download &&
        section.type !== "text"
        ? [
            {
              download: true,
              href: sectionExportHref(slug, section.id),
              icon: "download",
              id: `download-section-${section.id}`,
              label: copy.downloadSection(
                section.title || copy.sectionType(section.type),
              ),
              variant: "ghost",
            },
          ]
        : [];
    },
  };
}

function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function PortalSummary({
  document,
  editable,
  onPortalChange,
}: {
  document: PortalDocument;
  editable?: boolean;
  onPortalChange: (portal: PortalDocument["portal"]) => void;
}) {
  const t = useTranslations("PortalViewer.summary");
  const portal = document.portal;

  return (
    <div className="flex flex-col gap-2">
      <Field>
        <Input
          aria-label={t("name")}
          className={cn(
            "border-none bg-transparent! px-0 text-2xl! font-medium shadow-none focus-visible:ring-0",
            !editable && "pointer-events-none",
          )}
          defaultValue={editable ? portal.name : undefined}
          onBlur={(event) =>
            editable &&
            onPortalChange?.({ ...portal, name: event.currentTarget.value })
          }
          readOnly={!editable}
          tabIndex={editable ? undefined : -1}
          value={editable ? undefined : portal.name}
        />
      </Field>
      <Field>
        <Textarea
          aria-label={t("description")}
          className={cn(
            "resize-none whitespace-pre-wrap border-none bg-transparent! px-0 text-muted-foreground shadow-none focus-visible:ring-0",
            !editable && "pointer-events-none",
          )}
          defaultValue={editable ? portal.description : undefined}
          onBlur={(event) =>
            editable &&
            onPortalChange?.({
              ...portal,
              description: event.currentTarget.value,
            })
          }
          readOnly={!editable}
          rows={2}
          tabIndex={editable ? undefined : -1}
          value={editable ? undefined : (portal.description ?? "")}
        />
      </Field>
    </div>
  );
}

function PortalSectionHeading({
  actions,
  controls,
  editable,
  onSectionTitleChange,
  section,
}: {
  actions: PortalAction[];
  controls?: ReactNode;
  editable?: boolean;
  onSectionTitleChange?: (
    section: RenderPortalProps["document"]["sections"][number],
  ) => void;
  section: RenderPortalProps["document"]["sections"][number];
}) {
  const t = useTranslations("PortalViewer.section");
  const sectionTypeT = useTranslations("PortalViewer.sectionTypes");
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2">
        {editable ? (
          <input
            className="w-full border-none bg-transparent px-0 font-heading font-medium text-lg text-primary! tracking-tight outline-none placeholder:text-muted-foreground"
            data-portal-section-title
            defaultValue={section.title}
            maxLength={70}
            minLength={1}
            onBlur={(event) =>
              onSectionTitleChange?.({
                ...section,
                title: event.currentTarget.value,
              })
            }
            placeholder={t("titlePlaceholder")}
          />
        ) : section.title ? (
          <h2 className="px-0 font-heading font-medium text-lg text-primary tracking-tight">
            {section.title}
          </h2>
        ) : (
          <span />
        )}
        {actions.length || controls ? (
          <PortalSectionActionsToolbar>
            <PortalActionButtons actions={actions} />
            {controls}
          </PortalSectionActionsToolbar>
        ) : null}
      </div>
      {editable ? (
        <Textarea
          className="resize-none border-none bg-transparent! px-0 text-muted-foreground text-sm shadow-none outline-none focus-visible:ring-0"
          defaultValue={section.description}
          maxLength={1500}
          onBlur={(event) =>
            onSectionTitleChange?.({
              ...section,
              description: event.currentTarget.value,
            })
          }
          placeholder={t("descriptionPlaceholder")}
        />
      ) : section.description ? (
        <Textarea
          aria-label={t("descriptionLabel", {
            title: section.title || sectionTypeT(section.type),
          })}
          className="pointer-events-none resize-none whitespace-pre-wrap border-none bg-transparent! px-0 text-muted-foreground text-sm shadow-none outline-none focus-visible:ring-0"
          readOnly
          tabIndex={-1}
          value={section.description}
        />
      ) : null}
      {section.content.body_md ? (
        <p className="whitespace-pre-wrap text-sm">{section.content.body_md}</p>
      ) : null}
    </div>
  );
}

export function RenderPortal({
  actionConfig,
  className,
  contentClassName,
  document,
  editable = false,
  editor,
  sidebar,
  visibility,
}: RenderPortalProps) {
  const t = useTranslations();
  const storeDocument = usePortalEditorStore((state) =>
    editor ? state.documentsByPortalId[editor.portalId] : undefined,
  );
  const setStoreDocument = usePortalEditorStore((state) => state.setDocument);
  const setHasUnpublishedChanges = usePortalEditorStore(
    (state) => state.setHasUnpublishedChanges,
  );
  const [, startTransition] = useTransition();
  const pendingSectionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!editor) return;
    setStoreDocument(editor.portalId, document);
  }, [document, editor, setStoreDocument]);

  const activeDocument = editor ? (storeDocument ?? document) : document;

  function saveEditableDocument(next: PortalDocument) {
    if (!editor) return;
    setStoreDocument(editor.portalId, next);
    setHasUnpublishedChanges(editor.portalId, true);
    startTransition(() => {
      const fd = new FormData();
      fd.set("locale", editor.locale);
      fd.set("portal_id", editor.portalId);
      fd.set("document_json", JSON.stringify(next));
      updatePortalDocument(fd);
    });
  }

  function saveEditablePortal(nextPortal: PortalDocument["portal"]) {
    if (!editor) return;
    setStoreDocument(editor.portalId, {
      ...activeDocument,
      portal: nextPortal,
    });
    setHasUnpublishedChanges(editor.portalId, true);
    startTransition(() => {
      const fd = new FormData();
      fd.set("locale", editor.locale);
      fd.set("portal_id", editor.portalId);
      fd.set("name", nextPortal.name);
      fd.set("short_description", nextPortal.description ?? "");
      updatePortalSummary({ error: null, saved: false }, fd);
    });
  }

  function updateEditableSection(nextSection: PortalSection) {
    if (!editor) return;
    saveEditableDocument({
      ...activeDocument,
      sections: activeDocument.sections.map((section) =>
        section.id === nextSection.id ? nextSection : section,
      ),
    });
  }

  function removeEditableSection(sectionId: string) {
    if (!editor) return;
    saveEditableDocument({
      ...activeDocument,
      sections: reindex(
        activeDocument.sections.filter((section) => section.id !== sectionId),
      ),
    });
  }

  function addEditableSection(
    type: Exclude<PortalSectionType, "empty"> = "text",
  ) {
    if (!editor) return;
    const section = createPortalSection(type, activeDocument.sections.length);
    pendingSectionIdRef.current = section.id;
    saveEditableDocument({
      ...activeDocument,
      sections: [...activeDocument.sections, section],
    });
  }

  function activatePendingSection() {
    const sectionId = pendingSectionIdRef.current;
    if (!sectionId) return;
    pendingSectionIdRef.current = null;
    scrollToPortalSection(sectionId);
    focusPortalSectionTitle(sectionId);
  }

  useEffect(() => {
    if (!editor?.focus) return;
    scrollToPortalSection(editor.focus);
    focusPortalSectionTitle(editor.focus);
  }, [editor?.focus]);

  const renderDocument = editor
    ? {
        ...activeDocument,
        sections: uniqueForRender(activeDocument.sections, "sec"),
      }
    : activeDocument;

  const visibleSections = renderDocument.sections.filter((section) => {
    if (!visibility?.showHiddenSections && !section.visible) return false;
    if (!visibility?.showEmptySections && section.type === "empty")
      return false;
    if (visibility?.requireContent && !hasPublicSectionContent(section)) {
      return false;
    }
    return true;
  });
  const renderActions = actionConfig?.public
    ? buildPublicActions({
        ...actionConfig.public,
        copy: {
          copied: t("PortalViewer.actions.copied"),
          copyColor: (color) => t("PortalViewer.actions.copyColor", { color }),
          downloadFile: (name) =>
            t("PortalViewer.actions.downloadFile", { name }),
          downloadFont: (name) =>
            t("PortalViewer.actions.downloadFont", { name }),
          downloadImage: (name) =>
            t("PortalViewer.actions.downloadImage", { name }),
          downloadSection: (name) =>
            t("PortalViewer.actions.downloadSection", { name }),
          exportAll: t("PortalViewer.actions.exportAll"),
          imageFallback: t("PortalViewer.actions.imageFallback"),
          sectionType: (type) => t(`PortalViewer.sectionTypes.${type}`),
        },
      })
    : undefined;
  const globalActions = compactActions(renderActions?.global?.());

  return (
    <PortalShell className={className} sidebar={sidebar}>
      <section
        className={cn("relative flex flex-col gap-10 pb-40", contentClassName)}
      >
        {globalActions.length ? (
          <PortalGlobalActionsOverlay>
            <PortalActionButtons actions={globalActions} />
          </PortalGlobalActionsOverlay>
        ) : null}
        <PortalSummary
          document={renderDocument}
          editable={editable}
          onPortalChange={saveEditablePortal}
        />
        <div className="flex flex-col gap-30 pt-10">
          {visibleSections.map((section) => (
            <section
              className="group/section relative flex scroll-mt-8 flex-col gap-4 p-0"
              id={section.id}
              key={section.id}
            >
              <PortalSectionHeading
                actions={compactActions(renderActions?.section?.(section))}
                controls={
                  editor ? (
                    <SectionActionToolbar
                      onRemove={() => removeEditableSection(section.id)}
                      section={section}
                      updateSection={updateEditableSection}
                    />
                  ) : null
                }
                editable={editable}
                onSectionTitleChange={updateEditableSection}
                section={section}
              />
              {editor ? (
                <SectionContentEditor
                  portalId={editor.portalId}
                  section={section}
                  updateSection={updateEditableSection}
                />
              ) : (
                <PortalSectionVisual
                  actions={renderActions}
                  section={section}
                />
              )}
            </section>
          ))}
        </div>
        {editor ? (
          <div className="mx-auto mt-10">
            <SectionTypeDialog
              onSelect={addEditableSection}
              onSelectComplete={activatePendingSection}
              trigger={
                <PortalActionTriggerButton
                  icon="plus"
                  label={t("PortalEditor.sections.add")}
                  size="icon-lg"
                  variant="outline"
                />
              }
            />
          </div>
        ) : null}
      </section>
    </PortalShell>
  );
}
