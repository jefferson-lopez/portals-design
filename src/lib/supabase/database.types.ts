export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      portal_access_sessions: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          portal_id: string;
          token_hash: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          id?: string;
          portal_id: string;
          token_hash: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          portal_id?: string;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "portal_access_sessions_portal_id_fkey";
            columns: ["portal_id"];
            isOneToOne: false;
            referencedRelation: "portals";
            referencedColumns: ["id"];
          },
        ];
      };
      portal_assets: {
        Row: {
          allow_download: boolean;
          block_id: string | null;
          category: string | null;
          created_at: string;
          deletion_requested_at: string | null;
          file_path: string;
          id: string;
          metadata: Json;
          mime_type: string | null;
          name: string;
          owner_id: string;
          portal_id: string;
          position: number;
          reservation_expires_at: string | null;
          size_bytes: number | null;
          state: Database["public"]["Enums"]["portal_asset_state"];
          updated_at: string;
        };
        Insert: {
          allow_download?: boolean;
          block_id?: string | null;
          category?: string | null;
          created_at?: string;
          deletion_requested_at?: string | null;
          file_path: string;
          id?: string;
          metadata?: Json;
          mime_type?: string | null;
          name: string;
          owner_id: string;
          portal_id: string;
          position?: number;
          reservation_expires_at?: string | null;
          size_bytes?: number | null;
          state?: Database["public"]["Enums"]["portal_asset_state"];
          updated_at?: string;
        };
        Update: {
          allow_download?: boolean;
          block_id?: string | null;
          category?: string | null;
          created_at?: string;
          deletion_requested_at?: string | null;
          file_path?: string;
          id?: string;
          metadata?: Json;
          mime_type?: string | null;
          name?: string;
          owner_id?: string;
          portal_id?: string;
          position?: number;
          reservation_expires_at?: string | null;
          size_bytes?: number | null;
          state?: Database["public"]["Enums"]["portal_asset_state"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "portal_assets_block_id_fkey";
            columns: ["block_id"];
            isOneToOne: false;
            referencedRelation: "portal_blocks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "portal_assets_portal_id_fkey";
            columns: ["portal_id"];
            isOneToOne: false;
            referencedRelation: "portals";
            referencedColumns: ["id"];
          },
        ];
      };
      portal_blocks: {
        Row: {
          allow_download: boolean;
          content: Json;
          created_at: string;
          description: string;
          id: string;
          is_visible: boolean;
          layout: string;
          portal_id: string;
          position: number;
          title: string;
          type: Database["public"]["Enums"]["portal_block_type"];
          updated_at: string;
        };
        Insert: {
          allow_download?: boolean;
          content?: Json;
          created_at?: string;
          description?: string;
          id?: string;
          is_visible?: boolean;
          layout?: string;
          portal_id: string;
          position?: number;
          title?: string;
          type: Database["public"]["Enums"]["portal_block_type"];
          updated_at?: string;
        };
        Update: {
          allow_download?: boolean;
          content?: Json;
          created_at?: string;
          description?: string;
          id?: string;
          is_visible?: boolean;
          layout?: string;
          portal_id?: string;
          position?: number;
          title?: string;
          type?: Database["public"]["Enums"]["portal_block_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "portal_blocks_portal_id_fkey";
            columns: ["portal_id"];
            isOneToOne: false;
            referencedRelation: "portals";
            referencedColumns: ["id"];
          },
        ];
      };
      portal_checkout_attempts: {
        Row: {
          created_at: string;
          idempotency_key: string;
          portal_id: string;
          purchaser_id: string;
          status: string;
          stripe_checkout_session_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          idempotency_key?: string;
          portal_id: string;
          purchaser_id: string;
          status?: string;
          stripe_checkout_session_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          idempotency_key?: string;
          portal_id?: string;
          purchaser_id?: string;
          status?: string;
          stripe_checkout_session_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "portal_checkout_attempts_portal_id_fkey";
            columns: ["portal_id"];
            isOneToOne: true;
            referencedRelation: "portals";
            referencedColumns: ["id"];
          },
        ];
      };
      portal_documents: {
        Row: {
          created_at: string;
          document: Json;
          id: string;
          portal_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          document?: Json;
          id?: string;
          portal_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          document?: Json;
          id?: string;
          portal_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "portal_documents_portal_id_fkey";
            columns: ["portal_id"];
            isOneToOne: true;
            referencedRelation: "portals";
            referencedColumns: ["id"];
          },
        ];
      };
      portal_entitlements: {
        Row: {
          amount_total: number;
          created_at: string;
          currency: string;
          id: string;
          portal_id: string;
          purchased_at: string | null;
          purchaser_id: string | null;
          revoked_at: string | null;
          status: Database["public"]["Enums"]["portal_entitlement_status"];
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string;
          updated_at: string;
        };
        Insert: {
          amount_total: number;
          created_at?: string;
          currency: string;
          id?: string;
          portal_id: string;
          purchased_at?: string | null;
          purchaser_id?: string | null;
          revoked_at?: string | null;
          status: Database["public"]["Enums"]["portal_entitlement_status"];
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id: string;
          updated_at?: string;
        };
        Update: {
          amount_total?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          portal_id?: string;
          purchased_at?: string | null;
          purchaser_id?: string | null;
          revoked_at?: string | null;
          status?: Database["public"]["Enums"]["portal_entitlement_status"];
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "portal_entitlements_portal_id_fkey";
            columns: ["portal_id"];
            isOneToOne: true;
            referencedRelation: "portals";
            referencedColumns: ["id"];
          },
        ];
      };
      portal_members: {
        Row: {
          created_at: string;
          portal_id: string;
          role: Database["public"]["Enums"]["portal_member_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          portal_id: string;
          role?: Database["public"]["Enums"]["portal_member_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          portal_id?: string;
          role?: Database["public"]["Enums"]["portal_member_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "portal_members_portal_id_fkey";
            columns: ["portal_id"];
            isOneToOne: false;
            referencedRelation: "portals";
            referencedColumns: ["id"];
          },
        ];
      };
      portal_payment_states: {
        Row: {
          last_event_created: number;
          portal_id: string | null;
          status: Database["public"]["Enums"]["portal_entitlement_status"];
          stripe_payment_intent_id: string;
          updated_at: string;
        };
        Insert: {
          last_event_created?: number;
          portal_id?: string | null;
          status: Database["public"]["Enums"]["portal_entitlement_status"];
          stripe_payment_intent_id: string;
          updated_at?: string;
        };
        Update: {
          last_event_created?: number;
          portal_id?: string | null;
          status?: Database["public"]["Enums"]["portal_entitlement_status"];
          stripe_payment_intent_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "portal_payment_states_portal_id_fkey";
            columns: ["portal_id"];
            isOneToOne: false;
            referencedRelation: "portals";
            referencedColumns: ["id"];
          },
        ];
      };
      portal_publications: {
        Row: {
          created_at: string;
          id: string;
          portal_id: string;
          published_by: string | null;
          snapshot: Json;
          version: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          portal_id: string;
          published_by?: string | null;
          snapshot: Json;
          version: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          portal_id?: string;
          published_by?: string | null;
          snapshot?: Json;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "portal_publications_portal_id_fkey";
            columns: ["portal_id"];
            isOneToOne: false;
            referencedRelation: "portals";
            referencedColumns: ["id"];
          },
        ];
      };
      portals: {
        Row: {
          allow_asset_downloads: boolean;
          allow_color_copy: boolean;
          allow_downloads: boolean;
          allow_pdf_downloads: boolean;
          cover_url: string | null;
          created_at: string;
          custom_domain: string | null;
          designer_logo_url: string | null;
          designer_name: string | null;
          designer_photo_url: string | null;
          designer_social_links: Json;
          designer_website_url: string | null;
          icon_url: string | null;
          id: string;
          name: string;
          owner_id: string;
          password_hash: string | null;
          published_at: string | null;
          published_publication_id: string | null;
          seo_description: string | null;
          seo_title: string | null;
          short_description: string | null;
          slug: string;
          social_image_url: string | null;
          status: Database["public"]["Enums"]["portal_status"];
          theme: Database["public"]["Enums"]["portal_theme"];
          updated_at: string;
          visibility: Database["public"]["Enums"]["portal_visibility"];
        };
        Insert: {
          allow_asset_downloads?: boolean;
          allow_color_copy?: boolean;
          allow_downloads?: boolean;
          allow_pdf_downloads?: boolean;
          cover_url?: string | null;
          created_at?: string;
          custom_domain?: string | null;
          designer_logo_url?: string | null;
          designer_name?: string | null;
          designer_photo_url?: string | null;
          designer_social_links?: Json;
          designer_website_url?: string | null;
          icon_url?: string | null;
          id?: string;
          name: string;
          owner_id: string;
          password_hash?: string | null;
          published_at?: string | null;
          published_publication_id?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          short_description?: string | null;
          slug: string;
          social_image_url?: string | null;
          status?: Database["public"]["Enums"]["portal_status"];
          theme?: Database["public"]["Enums"]["portal_theme"];
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["portal_visibility"];
        };
        Update: {
          allow_asset_downloads?: boolean;
          allow_color_copy?: boolean;
          allow_downloads?: boolean;
          allow_pdf_downloads?: boolean;
          cover_url?: string | null;
          created_at?: string;
          custom_domain?: string | null;
          designer_logo_url?: string | null;
          designer_name?: string | null;
          designer_photo_url?: string | null;
          designer_social_links?: Json;
          designer_website_url?: string | null;
          icon_url?: string | null;
          id?: string;
          name?: string;
          owner_id?: string;
          password_hash?: string | null;
          published_at?: string | null;
          published_publication_id?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          short_description?: string | null;
          slug?: string;
          social_image_url?: string | null;
          status?: Database["public"]["Enums"]["portal_status"];
          theme?: Database["public"]["Enums"]["portal_theme"];
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["portal_visibility"];
        };
        Relationships: [
          {
            foreignKeyName: "portals_published_publication_id_fkey";
            columns: ["published_publication_id"];
            isOneToOne: false;
            referencedRelation: "portal_publications";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          updated_at: string;
          website_url: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          updated_at?: string;
          website_url?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
          website_url?: string | null;
        };
        Relationships: [];
      };
      stripe_events: {
        Row: {
          event_type: string;
          processed_at: string;
          stripe_event_id: string;
        };
        Insert: {
          event_type: string;
          processed_at?: string;
          stripe_event_id: string;
        };
        Update: {
          event_type?: string;
          processed_at?: string;
          stripe_event_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      apply_portal_entitlement_event:
        | {
            Args: {
              event_amount_total: number;
              event_checkout_session_id: string;
              event_currency: string;
              event_id: string;
              event_payment_intent_id: string;
              event_portal_id: string;
              event_purchaser_id: string;
              event_status: Database["public"]["Enums"]["portal_entitlement_status"];
              event_type: string;
            };
            Returns: boolean;
          }
        | {
            Args: {
              event_amount_total: number;
              event_checkout_session_id: string;
              event_created?: number;
              event_currency: string;
              event_id: string;
              event_payment_intent_id: string;
              event_portal_id: string;
              event_purchaser_id: string;
              event_status: Database["public"]["Enums"]["portal_entitlement_status"];
              event_type: string;
            };
            Returns: boolean;
          };
      begin_portal_checkout: {
        Args: { target_portal_id: string };
        Returns: {
          created_at: string;
          idempotency_key: string;
          portal_id: string;
          purchaser_id: string;
          status: string;
          stripe_checkout_session_id: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "portal_checkout_attempts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      can_edit_portal: { Args: { target_portal_id: string }; Returns: boolean };
      create_empty_portal_section: {
        Args: { section_position?: number; target_portal_id: string };
        Returns: {
          allow_download: boolean;
          content: Json;
          created_at: string;
          description: string;
          id: string;
          is_visible: boolean;
          layout: string;
          portal_id: string;
          position: number;
          title: string;
          type: Database["public"]["Enums"]["portal_block_type"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "portal_blocks";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_portal: {
        Args: {
          portal_cover_url?: string;
          portal_name: string;
          portal_slug: string;
          portal_visibility?: Database["public"]["Enums"]["portal_visibility"];
        };
        Returns: {
          allow_asset_downloads: boolean;
          allow_color_copy: boolean;
          allow_downloads: boolean;
          allow_pdf_downloads: boolean;
          cover_url: string | null;
          created_at: string;
          custom_domain: string | null;
          designer_logo_url: string | null;
          designer_name: string | null;
          designer_photo_url: string | null;
          designer_social_links: Json;
          designer_website_url: string | null;
          icon_url: string | null;
          id: string;
          name: string;
          owner_id: string;
          password_hash: string | null;
          published_at: string | null;
          published_publication_id: string | null;
          seo_description: string | null;
          seo_title: string | null;
          short_description: string | null;
          slug: string;
          social_image_url: string | null;
          status: Database["public"]["Enums"]["portal_status"];
          theme: Database["public"]["Enums"]["portal_theme"];
          updated_at: string;
          visibility: Database["public"]["Enums"]["portal_visibility"];
        };
        SetofOptions: {
          from: "*";
          to: "portals";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      default_portal_document: {
        Args: { target_portal_id: string };
        Returns: Json;
      };
      delete_portal_asset_record: {
        Args: { target_asset_id: string };
        Returns: string;
      };
      delete_portal_block: {
        Args: { target_block_id: string; target_portal_id: string };
        Returns: undefined;
      };
      delete_portal: {
        Args: { target_portal_id: string };
        Returns: boolean;
      };
      ensure_portal_document: {
        Args: { target_portal_id: string };
        Returns: {
          created_at: string;
          document: Json;
          id: string;
          portal_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "portal_documents";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      finalize_portal_asset: {
        Args: {
          actual_mime_type: string;
          actual_size_bytes: number;
          target_asset_id: string;
        };
        Returns: {
          allow_download: boolean;
          block_id: string | null;
          category: string | null;
          created_at: string;
          deletion_requested_at: string | null;
          file_path: string;
          id: string;
          metadata: Json;
          mime_type: string | null;
          name: string;
          owner_id: string;
          portal_id: string;
          position: number;
          reservation_expires_at: string | null;
          size_bytes: number | null;
          state: Database["public"]["Enums"]["portal_asset_state"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "portal_assets";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      finalize_portal_asset_deletion: {
        Args: { target_asset_id: string };
        Returns: boolean;
      };
      get_public_portal_payload: {
        Args: { portal_slug: string };
        Returns: Json;
      };
      is_portal_owner: { Args: { target_portal_id: string }; Returns: boolean };
      is_portal_slug_available: {
        Args: { candidate_slug: string; current_portal_id?: string };
        Returns: boolean;
      };
      portal_document_asset_ids: {
        Args: { candidate_document: Json };
        Returns: {
          asset_id: string;
        }[];
      };
      portal_document_metric: {
        Args: { metric: string; portal_document: Json };
        Returns: number;
      };
      portal_has_premium: {
        Args: { target_portal_id: string };
        Returns: boolean;
      };
      publish_portal: {
        Args: { target_portal_id: string };
        Returns: {
          created_at: string;
          id: string;
          portal_id: string;
          published_by: string | null;
          snapshot: Json;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "portal_publications";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reorder_portal_blocks: {
        Args: { ordered_block_ids: string[]; target_portal_id: string };
        Returns: undefined;
      };
      reserve_portal_asset: {
        Args: {
          asset_category: string;
          asset_id: string;
          asset_mime_type: string;
          asset_name: string;
          asset_size_bytes: number;
          target_portal_id: string;
        };
        Returns: {
          allow_download: boolean;
          block_id: string | null;
          category: string | null;
          created_at: string;
          deletion_requested_at: string | null;
          file_path: string;
          id: string;
          metadata: Json;
          mime_type: string | null;
          name: string;
          owner_id: string;
          portal_id: string;
          position: number;
          reservation_expires_at: string | null;
          size_bytes: number | null;
          state: Database["public"]["Enums"]["portal_asset_state"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "portal_assets";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_portal_block_type: {
        Args: {
          block_layout?: string;
          block_type: Database["public"]["Enums"]["portal_block_type"];
          target_block_id: string;
          target_portal_id: string;
        };
        Returns: {
          allow_download: boolean;
          content: Json;
          created_at: string;
          description: string;
          id: string;
          is_visible: boolean;
          layout: string;
          portal_id: string;
          position: number;
          title: string;
          type: Database["public"]["Enums"]["portal_block_type"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "portal_blocks";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_portal_privacy: {
        Args: {
          portal_password?: string;
          portal_visibility: Database["public"]["Enums"]["portal_visibility"];
          target_portal_id: string;
        };
        Returns: boolean;
      };
      unlock_portal: {
        Args: {
          portal_password: string;
          portal_slug: string;
          session_expires_at: string;
          session_token_hash: string;
        };
        Returns: string;
      };
      update_portal_section_shell: {
        Args: {
          section_description?: string;
          section_title: string;
          target_block_id: string;
          target_portal_id: string;
        };
        Returns: {
          allow_download: boolean;
          content: Json;
          created_at: string;
          description: string;
          id: string;
          is_visible: boolean;
          layout: string;
          portal_id: string;
          position: number;
          title: string;
          type: Database["public"]["Enums"]["portal_block_type"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "portal_blocks";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_portal_settings: {
        Args: {
          portal_allow_asset_downloads?: boolean;
          portal_allow_color_copy?: boolean;
          portal_allow_downloads?: boolean;
          portal_allow_pdf_downloads?: boolean;
          portal_cover_url?: string;
          portal_custom_domain?: string;
          portal_designer_logo_url?: string;
          portal_designer_name?: string;
          portal_designer_photo_url?: string;
          portal_designer_website_url?: string;
          portal_icon_url?: string;
          portal_name: string;
          portal_seo_description?: string;
          portal_seo_title?: string;
          portal_short_description?: string;
          portal_slug: string;
          portal_social_image_url?: string;
          portal_theme?: Database["public"]["Enums"]["portal_theme"];
          portal_visibility?: Database["public"]["Enums"]["portal_visibility"];
          target_portal_id: string;
        };
        Returns: {
          allow_asset_downloads: boolean;
          allow_color_copy: boolean;
          allow_downloads: boolean;
          allow_pdf_downloads: boolean;
          cover_url: string | null;
          created_at: string;
          custom_domain: string | null;
          designer_logo_url: string | null;
          designer_name: string | null;
          designer_photo_url: string | null;
          designer_social_links: Json;
          designer_website_url: string | null;
          icon_url: string | null;
          id: string;
          name: string;
          owner_id: string;
          password_hash: string | null;
          published_at: string | null;
          published_publication_id: string | null;
          seo_description: string | null;
          seo_title: string | null;
          short_description: string | null;
          slug: string;
          social_image_url: string | null;
          status: Database["public"]["Enums"]["portal_status"];
          theme: Database["public"]["Enums"]["portal_theme"];
          updated_at: string;
          visibility: Database["public"]["Enums"]["portal_visibility"];
        };
        SetofOptions: {
          from: "*";
          to: "portals";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_portal_summary: {
        Args: {
          portal_name: string;
          portal_short_description?: string;
          target_portal_id: string;
        };
        Returns: {
          allow_asset_downloads: boolean;
          allow_color_copy: boolean;
          allow_downloads: boolean;
          allow_pdf_downloads: boolean;
          cover_url: string | null;
          created_at: string;
          custom_domain: string | null;
          designer_logo_url: string | null;
          designer_name: string | null;
          designer_photo_url: string | null;
          designer_social_links: Json;
          designer_website_url: string | null;
          icon_url: string | null;
          id: string;
          name: string;
          owner_id: string;
          password_hash: string | null;
          published_at: string | null;
          published_publication_id: string | null;
          seo_description: string | null;
          seo_title: string | null;
          short_description: string | null;
          slug: string;
          social_image_url: string | null;
          status: Database["public"]["Enums"]["portal_status"];
          theme: Database["public"]["Enums"]["portal_theme"];
          updated_at: string;
          visibility: Database["public"]["Enums"]["portal_visibility"];
        };
        SetofOptions: {
          from: "*";
          to: "portals";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      upsert_portal_block: {
        Args: {
          block_allow_download?: boolean;
          block_content?: Json;
          block_description?: string;
          block_id: string;
          block_is_visible?: boolean;
          block_layout?: string;
          block_position?: number;
          block_title: string;
          block_type: Database["public"]["Enums"]["portal_block_type"];
          target_portal_id: string;
        };
        Returns: {
          allow_download: boolean;
          content: Json;
          created_at: string;
          description: string;
          id: string;
          is_visible: boolean;
          layout: string;
          portal_id: string;
          position: number;
          title: string;
          type: Database["public"]["Enums"]["portal_block_type"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "portal_blocks";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      upsert_portal_document: {
        Args: { portal_document: Json; target_portal_id: string };
        Returns: {
          created_at: string;
          document: Json;
          id: string;
          portal_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "portal_documents";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      validate_portal_document_policy: {
        Args: {
          candidate_document: Json;
          require_compliant?: boolean;
          target_portal_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      portal_asset_state: "reserved" | "ready";
      portal_block_type:
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
      portal_entitlement_status: "active" | "refunded" | "disputed" | "revoked";
      portal_member_role: "owner" | "editor" | "viewer";
      portal_status: "draft" | "published";
      portal_theme: "light" | "dark" | "auto";
      portal_visibility: "public" | "private" | "password" | "invite_only";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      portal_asset_state: ["reserved", "ready"],
      portal_block_type: [
        "text",
        "image",
        "gallery",
        "color",
        "typography",
        "file",
        "video",
        "comparison",
        "divider",
        "assets",
        "empty",
      ],
      portal_entitlement_status: ["active", "refunded", "disputed", "revoked"],
      portal_member_role: ["owner", "editor", "viewer"],
      portal_status: ["draft", "published"],
      portal_theme: ["light", "dark", "auto"],
      portal_visibility: ["public", "private", "password", "invite_only"],
    },
  },
} as const;

export type Portal = Tables<"portals">;
export type PortalBlock = Tables<"portal_blocks">;
export type PortalDocumentRowType = Tables<"portal_documents">;
export type PortalPublication = Tables<"portal_publications">;
export type PortalBlockType = Enums<"portal_block_type">;
export type PortalStatus = Enums<"portal_status">;
export type PortalTheme = Enums<"portal_theme">;
export type PortalVisibility = Enums<"portal_visibility">;
