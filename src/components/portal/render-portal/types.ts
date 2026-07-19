import type { ReactNode } from "react";
import type {
  PortalColorItem,
  PortalDocument,
  PortalFileItem,
  PortalFontItem,
  PortalImageItem,
  PortalSection,
} from "@/lib/portal/document";

export type PortalActionIcon =
  | "copy"
  | "download"
  | "edit"
  | "export"
  | "layers"
  | "lock"
  | "open"
  | "plus"
  | "refresh"
  | "remove"
  | "settings";

export type PortalAction = {
  disabled?: boolean;
  download?: boolean;
  feedbackLabel?: string;
  href?: string;
  icon: PortalActionIcon;
  id: string;
  label: string;
  onClick?: () => void;
  size?: "icon-lg" | "icon-sm";
  variant?: "ghost" | "outline" | "secondary";
};

export type PortalActionContext<TItem> = {
  item: TItem;
  section: PortalSection;
};

export type PortalRenderActions = {
  color?: (context: PortalActionContext<PortalColorItem>) => PortalAction[];
  file?: (context: PortalActionContext<PortalFileItem>) => PortalAction[];
  font?: (context: PortalActionContext<PortalFontItem>) => PortalAction[];
  global?: () => PortalAction[];
  image?: (context: PortalActionContext<PortalImageItem>) => PortalAction[];
  section?: (section: PortalSection) => PortalAction[];
};

export type PortalRenderVisibility = {
  requireContent?: boolean;
  showEmptySections?: boolean;
  showHiddenSections?: boolean;
};

export type PortalPublicActionSlots = {
  global?: { exportAssets?: boolean };
  item?: {
    color?: { copy?: boolean };
    file?: { download?: boolean };
    font?: { download?: boolean };
    image?: { download?: boolean };
  };
  section?: { download?: boolean };
};

export type PortalPublicActionConfig = {
  slug: string;
  slots: PortalPublicActionSlots;
};

export type PortalActionConfig = {
  public?: PortalPublicActionConfig;
};

export type RenderPortalProps = {
  actionConfig?: PortalActionConfig;
  className?: string;
  contentClassName?: string;
  document: PortalDocument;
  editable?: boolean;
  editor?: { focus?: string; locale: string; portalId: string };
  sidebar?: ReactNode;
  visibility?: PortalRenderVisibility;
};
