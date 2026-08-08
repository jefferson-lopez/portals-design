import type { PortalDocument } from "@/lib/portal/document";

export type PortalPublicationIssueCode =
  | "portal_name_required"
  | "section_required"
  | "section_title_required";

export type PortalPublicationTarget =
  | { kind: "portal-name" }
  | { kind: "add-section" }
  | { kind: "section-title"; sectionId: string };

export type PortalPublicationIssue =
  | {
      code: "portal_name_required";
      target: { kind: "portal-name" };
    }
  | {
      code: "section_required";
      target: { kind: "add-section" };
    }
  | {
      code: "section_title_required";
      sectionId: string;
      target: { kind: "section-title"; sectionId: string };
    };

export function validatePortalPublicationReadiness(
  document: PortalDocument,
): PortalPublicationIssue[] {
  const issues: PortalPublicationIssue[] = [];

  if (!document.portal.name.trim()) {
    issues.push({
      code: "portal_name_required",
      target: { kind: "portal-name" },
    });
  }

  if (document.sections.length === 0) {
    issues.push({
      code: "section_required",
      target: { kind: "add-section" },
    });
  }

  for (const section of document.sections) {
    if (!section.title.trim()) {
      issues.push({
        code: "section_title_required",
        sectionId: section.id,
        target: { kind: "section-title", sectionId: section.id },
      });
    }
  }

  return issues;
}
