import type { PortalPublicationTarget } from "./publication-readiness";

export const PORTAL_OPEN_ADD_SECTION_DIALOG_EVENT =
  "portal-open-add-section-dialog";

type ScrollDocument = {
  getElementById: (id: string) => Pick<HTMLElement, "scrollIntoView"> | null;
};

type FocusDocument = {
  getElementById: (id: string) => {
    querySelector: (selector: string) => Pick<HTMLInputElement, "focus"> | null;
  } | null;
};

type PublicationFocusElement = Pick<HTMLElement, "focus"> &
  Partial<Pick<HTMLElement, "scrollIntoView">>;

type PublicationFocusDocument = {
  getElementById: (id: string) => {
    querySelector: (selector: string) => Pick<HTMLInputElement, "focus"> | null;
    scrollIntoView: HTMLElement["scrollIntoView"];
  } | null;
  querySelector: (selector: string) => PublicationFocusElement | null;
  dispatchEvent?: (event: Event) => boolean;
};

type PublicationEventDocument = {
  dispatchEvent: (event: Event) => boolean;
};

export function scrollToPortalSection(
  sectionId: string,
  document: ScrollDocument = window.document,
) {
  const section = document.getElementById(sectionId);
  if (!section) return false;

  section.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

export function focusPortalSectionTitle(
  sectionId: string,
  document: FocusDocument = window.document as FocusDocument,
) {
  const title = document
    .getElementById(sectionId)
    ?.querySelector("[data-portal-section-title]");
  if (!title) return false;

  title.focus({ preventScroll: true });
  return true;
}

export function focusPortalName(
  document: Pick<
    PublicationFocusDocument,
    "querySelector"
  > = window.document as unknown as PublicationFocusDocument,
) {
  const name = document.querySelector("[data-portal-name]");
  if (!name) return false;

  name.scrollIntoView?.({ behavior: "smooth", block: "center" });
  name.focus({ preventScroll: true });
  return true;
}

export function focusPortalAddSection(
  document: Pick<
    PublicationFocusDocument,
    "querySelector"
  > = window.document as unknown as PublicationFocusDocument,
) {
  const trigger = document.querySelector("[data-portal-add-section]");
  if (!trigger) return false;

  trigger.focus({ preventScroll: false });
  return true;
}

export function requestPortalAddSectionDialog(
  document: PublicationEventDocument = window.document,
) {
  return document.dispatchEvent(
    new CustomEvent(PORTAL_OPEN_ADD_SECTION_DIALOG_EVENT, {
      detail: { key: "portal-add-section" },
    }),
  );
}

export function focusPortalPublicationTarget(
  target: PortalPublicationTarget,
  document: PublicationFocusDocument = window.document as unknown as PublicationFocusDocument,
) {
  if (target.kind === "portal-name") return focusPortalName(document);
  if (target.kind === "add-section") {
    const focused = focusPortalAddSection(document);
    if (!focused) return false;
    if (!document.dispatchEvent) return true;
    requestPortalAddSectionDialog(document);
    return true;
  }

  scrollToPortalSection(target.sectionId, document);
  return focusPortalSectionTitle(target.sectionId, document);
}
