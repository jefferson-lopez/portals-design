export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PortalVisibility = "public" | "private" | "password";
export type PortalTheme = "light" | "dark" | "auto";
export type PortalStatus = "draft" | "published";
export type PortalBlockType =
  | "text"
  | "image"
  | "gallery"
  | "color"
  | "typography"
  | "file"
  | "video"
  | "comparison"
  | "divider"
  | "assets"
  | "empty";

type PortalRow = Record<string, unknown> & {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  short_description: string | null;
  cover_url: string | null;
  icon_url: string | null;
  visibility: PortalVisibility;
  password_hash: string | null;
  seo_title: string | null;
  seo_description: string | null;
  social_image_url: string | null;
  custom_domain: string | null;
  allow_downloads: boolean;
  allow_asset_downloads: boolean;
  allow_color_copy: boolean;
  allow_pdf_downloads: boolean;
  theme: PortalTheme;
  designer_name: string | null;
  designer_logo_url: string | null;
  designer_photo_url: string | null;
  designer_website_url: string | null;
  designer_social_links: Json;
  status: PortalStatus;
  published_publication_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type PortalBlockRow = Record<string, unknown> & {
  id: string;
  portal_id: string;
  title: string;
  description: string;
  type: PortalBlockType;
  layout: string;
  position: number;
  is_visible: boolean;
  allow_download: boolean;
  content: Json;
  created_at: string;
  updated_at: string;
};

type PortalDocumentRow = Record<string, unknown> & {
  id: string;
  portal_id: string;
  document: Json;
  created_at: string;
  updated_at: string;
};

type PortalPublicationRow = Record<string, unknown> & {
  id: string;
  portal_id: string;
  version: number;
  snapshot: Json;
  published_by: string | null;
  created_at: string;
};

type PortalAccessSessionRow = Record<string, unknown> & {
  id: string;
  portal_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      portals: {
        Row: PortalRow;
        Insert: Partial<PortalRow>;
        Update: Partial<PortalRow>;
        Relationships: [];
      };
      portal_blocks: {
        Row: PortalBlockRow;
        Insert: Partial<PortalBlockRow>;
        Update: Partial<PortalBlockRow>;
        Relationships: [];
      };
      portal_documents: {
        Row: PortalDocumentRow;
        Insert: Partial<PortalDocumentRow>;
        Update: Partial<PortalDocumentRow>;
        Relationships: [];
      };
      portal_publications: {
        Row: PortalPublicationRow;
        Insert: Partial<PortalPublicationRow>;
        Update: Partial<PortalPublicationRow>;
        Relationships: [];
      };
      portal_access_sessions: {
        Row: PortalAccessSessionRow;
        Insert: Partial<PortalAccessSessionRow>;
        Update: Partial<PortalAccessSessionRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_portal: {
        Args: {
          portal_name: string;
          portal_slug: string;
          portal_cover_url?: string | null;
          portal_visibility?: PortalVisibility;
        };
        Returns: PortalRow;
      };
      upsert_portal_block: {
        Args: {
          target_portal_id: string;
          block_id?: string | null;
          block_title: string;
          block_type: PortalBlockType;
          block_description?: string;
          block_layout?: string;
          block_position?: number;
          block_is_visible?: boolean;
          block_allow_download?: boolean;
          block_content?: Json;
        };
        Returns: PortalBlockRow;
      };

      update_portal_settings: {
        Args: {
          target_portal_id: string;
          portal_name: string;
          portal_slug: string;
          portal_short_description?: string | null;
          portal_cover_url?: string | null;
          portal_icon_url?: string | null;
          portal_visibility?: PortalVisibility;
          portal_seo_title?: string | null;
          portal_seo_description?: string | null;
          portal_social_image_url?: string | null;
          portal_custom_domain?: string | null;
          portal_allow_downloads?: boolean;
          portal_allow_asset_downloads?: boolean;
          portal_allow_color_copy?: boolean;
          portal_allow_pdf_downloads?: boolean;
          portal_theme?: PortalTheme;
          portal_designer_name?: string | null;
          portal_designer_logo_url?: string | null;
          portal_designer_photo_url?: string | null;
          portal_designer_website_url?: string | null;
        };
        Returns: PortalRow;
      };
      update_portal_summary: {
        Args: {
          target_portal_id: string;
          portal_name: string;
          portal_short_description?: string | null;
        };
        Returns: PortalRow;
      };
      delete_portal_block: {
        Args: { target_portal_id: string; target_block_id: string };
        Returns: undefined;
      };
      create_empty_portal_section: {
        Args: { target_portal_id: string; section_position?: number };
        Returns: PortalBlockRow;
      };
      ensure_portal_document: {
        Args: { target_portal_id: string };
        Returns: PortalDocumentRow;
      };
      upsert_portal_document: {
        Args: { target_portal_id: string; portal_document: Json };
        Returns: PortalDocumentRow;
      };
      default_portal_document: {
        Args: { target_portal_id: string };
        Returns: Json;
      };
      update_portal_section_shell: {
        Args: {
          target_portal_id: string;
          target_block_id: string;
          section_title: string;
          section_description?: string;
        };
        Returns: PortalBlockRow;
      };
      set_portal_block_type: {
        Args: {
          target_portal_id: string;
          target_block_id: string;
          block_type: PortalBlockType;
          block_layout?: string;
        };
        Returns: PortalBlockRow;
      };
      publish_portal: {
        Args: { target_portal_id: string };
        Returns: PortalPublicationRow;
      };
      reorder_portal_blocks: {
        Args: { target_portal_id: string; ordered_block_ids: string[] };
        Returns: undefined;
      };
      is_portal_slug_available: {
        Args: { candidate_slug: string; current_portal_id?: string | null };
        Returns: boolean;
      };
      set_portal_privacy: {
        Args: {
          target_portal_id: string;
          portal_visibility: PortalVisibility;
          portal_password?: string | null;
        };
        Returns: boolean;
      };
      unlock_portal: {
        Args: {
          portal_slug: string;
          portal_password: string;
          session_token_hash: string;
          session_expires_at: string;
        };
        Returns: string | null;
      };
      get_public_portal_payload: {
        Args: { portal_slug: string };
        Returns: Json | null;
      };
    };
    Enums: {
      portal_visibility: PortalVisibility;
      portal_theme: PortalTheme;
      portal_status: PortalStatus;
      portal_block_type: PortalBlockType;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Portal = PortalRow;
export type PortalBlock = PortalBlockRow;
export type PortalDocumentRowType = PortalDocumentRow;
export type PortalPublication = PortalPublicationRow;
