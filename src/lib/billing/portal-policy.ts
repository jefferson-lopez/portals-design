import type { PortalDocument, PortalSectionType } from "@/lib/portal/document";
import type { PortalVisibility } from "@/lib/supabase/database.types";

export type PortalPlan = "free" | "premium";
export type PortalPolicyCode =
  | "colors_items"
  | "colors_sections"
  | "files_items"
  | "files_sections"
  | "fonts_items"
  | "fonts_sections"
  | "gallery_items"
  | "gallery_sections"
  | "image_sections"
  | "password_requires_premium"
  | "plan_unavailable"
  | "storage_bytes"
  | "text_sections"
  | "total_sections"
  | "upload_bytes";

export type PortalUpgradeReason = PortalPolicyCode | "upgrade_info";

export function upgradeDescriptionKey(reason: PortalUpgradeReason) {
  return reason === "upgrade_info"
    ? ("upgradeDescription" as const)
    : (`violations.${reason}` as const);
}

type SectionLimits = Partial<
  Record<PortalSectionType, { items?: number; sections: number }>
>;

export type PortalPlanPolicy = {
  maxUploadBytes: number;
  storageBytes: number;
  totalSections: number;
  sections: SectionLimits;
};

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;

export const PORTAL_PLANS: Record<PortalPlan, PortalPlanPolicy> = {
  free: {
    maxUploadBytes: 50 * MiB,
    storageBytes: 100 * MiB,
    totalSections: Number.POSITIVE_INFINITY,
    sections: {
      colors: { items: 10, sections: 1 },
      files: { items: 10, sections: 1 },
      fonts: { items: 3, sections: 1 },
      gallery: { items: 10, sections: 1 },
      image: { sections: 1 },
      text: { sections: 2 },
    },
  },
  premium: {
    maxUploadBytes: 50 * MiB,
    storageBytes: 2 * GiB,
    totalSections: 100,
    sections: {
      files: { items: 10, sections: 2 },
      fonts: { items: 3, sections: 2 },
      gallery: { items: 15, sections: 3 },
    },
  },
};

export type PortalPolicyResult =
  | { ok: true }
  | { code: PortalPolicyCode; limit: number; ok: false; value: number };

type Metric = { code: PortalPolicyCode; limit: number; value: number };

function isSectionType(
  sectionType: PortalSectionType,
  type: PortalSectionType,
) {
  return type === "gallery"
    ? sectionType === "gallery" || sectionType === "image_comparison"
    : sectionType === type;
}

function itemCount(document: PortalDocument, type: PortalSectionType) {
  return Math.max(
    0,
    ...document.sections
      .filter((section) => isSectionType(section.type, type))
      .map((section) => {
        if (type === "gallery") return section.content.images?.length ?? 0;
        if (type === "colors") return section.content.colors?.length ?? 0;
        if (type === "fonts") return section.content.fonts?.length ?? 0;
        if (type === "files") return section.content.files?.length ?? 0;
        return 0;
      }),
  );
}

function metrics(document: PortalDocument, plan: PortalPlan): Metric[] {
  const policy = PORTAL_PLANS[plan];
  const result: Metric[] = [
    {
      code: "total_sections",
      limit: policy.totalSections,
      value: document.sections.length,
    },
  ];
  for (const [type, limit] of Object.entries(policy.sections) as Array<
    [PortalSectionType, { items?: number; sections: number }]
  >) {
    result.push({
      code: `${type}_sections` as PortalPolicyCode,
      limit: limit.sections,
      value: document.sections.filter((section) =>
        isSectionType(section.type, type),
      ).length,
    });
    if (limit.items !== undefined) {
      result.push({
        code: `${type}_items` as PortalPolicyCode,
        limit: limit.items,
        value: itemCount(document, type),
      });
    }
  }
  return result;
}

function firstViolation(document: PortalDocument, plan: PortalPlan) {
  return metrics(document, plan).find(({ limit, value }) => value > limit);
}

export function validatePortalDocumentChange(
  previous: PortalDocument,
  next: PortalDocument,
  plan: PortalPlan,
): PortalPolicyResult {
  const before = new Map(
    metrics(previous, plan).map((item) => [item.code, item]),
  );
  const violation = metrics(next, plan).find(
    ({ code, limit, value }) =>
      value > limit && value > (before.get(code)?.value ?? 0),
  );
  return violation ? { ...violation, ok: false } : { ok: true };
}

export function validatePortalPublication(
  document: PortalDocument,
  plan: PortalPlan,
): PortalPolicyResult {
  const violation = firstViolation(document, plan);
  return violation ? { ...violation, ok: false } : { ok: true };
}

export function validatePortalVisibility(
  visibility: PortalVisibility,
  plan: PortalPlan,
): PortalPolicyResult {
  return visibility === "password" && plan !== "premium"
    ? {
        code: "password_requires_premium",
        limit: 0,
        ok: false,
        value: 1,
      }
    : { ok: true };
}

export function getPortalPlanSnapshot(plan: PortalPlan) {
  return { plan, policy: PORTAL_PLANS[plan] };
}
