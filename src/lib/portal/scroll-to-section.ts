type ScrollDocument = {
  getElementById: (id: string) => Pick<HTMLElement, "scrollIntoView"> | null;
};

type FocusDocument = {
  getElementById: (id: string) => {
    querySelector: (selector: string) => Pick<HTMLInputElement, "focus"> | null;
  } | null;
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
