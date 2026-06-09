export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      customers: {
        Row: {
          address: string
          assigned_to: string | null
          comment: string
          created_at: string
          created_by: string | null
          full_name: string
          id: string
          last_synced_at: string | null
          organization_id: string
          phone: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string
          assigned_to?: string | null
          comment?: string
          created_at?: string
          created_by?: string | null
          full_name: string
          id?: string
          last_synced_at?: string | null
          organization_id: string
          phone?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          assigned_to?: string | null
          comment?: string
          created_at?: string
          created_by?: string | null
          full_name?: string
          id?: string
          last_synced_at?: string | null
          organization_id?: string
          phone?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      installation_profiles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          is_locked: boolean
          is_shared: boolean
          last_synced_at: string | null
          name: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          is_locked?: boolean
          is_shared?: boolean
          last_synced_at?: string | null
          name: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          is_locked?: boolean
          is_shared?: boolean
          last_synced_at?: string | null
          name?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installation_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          calculation_type: string
          coefficient: number
          created_at: string
          created_by: string | null
          id: string
          initial_quantity: number | null
          name: string
          organization_id: string
          price: number
          profile_id: string
          purchase_price: number | null
          total_cost: number | null
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calculation_type?: string
          coefficient?: number
          created_at?: string
          created_by?: string | null
          id?: string
          initial_quantity?: number | null
          name: string
          organization_id: string
          price?: number
          profile_id: string
          purchase_price?: number | null
          total_cost?: number | null
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calculation_type?: string
          coefficient?: number
          created_at?: string
          created_by?: string | null
          id?: string
          initial_quantity?: number | null
          name?: string
          organization_id?: string
          price?: number
          profile_id?: string
          purchase_price?: number | null
          total_cost?: number | null
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "installation_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          invited_by?: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          created_at: string
          created_by: string
          default_installation_profile_id: string | null
          details: Json
          email: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          organization_type: Database["public"]["Enums"]["org_type"]
          parent_organization_id: string | null
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by: string
          default_installation_profile_id?: string | null
          details?: Json
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          organization_type: Database["public"]["Enums"]["org_type"]
          parent_organization_id?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string
          default_installation_profile_id?: string | null
          details?: Json
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          organization_type?: Database["public"]["Enums"]["org_type"]
          parent_organization_id?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_parent_organization_id_fkey"
            columns: ["parent_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          approved_at: string | null
          area: number
          assigned_to: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          element_count: number
          estimate_data: Json | null
          estimate_total: number | null
          id: string
          last_synced_at: string | null
          organization_id: string
          perimeter: number
          points: Json
          profile_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          area?: number
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          element_count?: number
          estimate_data?: Json | null
          estimate_total?: number | null
          id?: string
          last_synced_at?: string | null
          organization_id: string
          perimeter?: number
          points?: Json
          profile_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          area?: number
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          element_count?: number
          estimate_data?: Json | null
          estimate_total?: number | null
          id?: string
          last_synced_at?: string | null
          organization_id?: string
          perimeter?: number
          points?: Json
          profile_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "installation_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      work_materials: {
        Row: {
          calculation_override: string | null
          created_at: string
          id: string
          material_id: string
          quantity: number
          work_id: string
        }
        Insert: {
          calculation_override?: string | null
          created_at?: string
          id?: string
          material_id: string
          quantity?: number
          work_id: string
        }
        Update: {
          calculation_override?: string | null
          created_at?: string
          id?: string
          material_id?: string
          quantity?: number
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_materials_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      works: {
        Row: {
          calculation_type: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string
          profile_id: string
          unit: string
          updated_at: string
          user_id: string
          work_price: number
        }
        Insert: {
          calculation_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id: string
          profile_id: string
          unit?: string
          updated_at?: string
          user_id: string
          work_price?: number
        }
        Update: {
          calculation_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          profile_id?: string
          unit?: string
          updated_at?: string
          user_id?: string
          work_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "works_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "works_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "installation_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { _token: string }; Returns: string }
      accessible_org_ids: { Args: { _user: string }; Returns: string[] }
      can_access_org: {
        Args: { _org: string; _user: string }
        Returns: boolean
      }
      can_manage_org: {
        Args: { _org: string; _user: string }
        Returns: boolean
      }
      create_organization: {
        Args: {
          _name: string
          _parent?: string
          _type: Database["public"]["Enums"]["org_type"]
        }
        Returns: {
          address: string | null
          created_at: string
          created_by: string
          default_installation_profile_id: string | null
          details: Json
          email: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          organization_type: Database["public"]["Enums"]["org_type"]
          parent_organization_id: string | null
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_org_role: {
        Args: {
          _org: string
          _roles: Database["public"]["Enums"]["app_role"][]
          _user: string
        }
        Returns: boolean
      }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "head_owner"
        | "head_admin"
        | "head_viewer"
        | "franchise_owner"
        | "franchise_admin"
        | "manager"
        | "measurer"
        | "viewer"
      invitation_status: "pending" | "accepted" | "expired" | "cancelled"
      member_status: "active" | "invited" | "disabled"
      org_type: "head" | "franchise"
      project_status:
        | "new"
        | "measurement_done"
        | "estimate_sent"
        | "approved"
        | "in_progress"
        | "completed"
        | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "head_owner",
        "head_admin",
        "head_viewer",
        "franchise_owner",
        "franchise_admin",
        "manager",
        "measurer",
        "viewer",
      ],
      invitation_status: ["pending", "accepted", "expired", "cancelled"],
      member_status: ["active", "invited", "disabled"],
      org_type: ["head", "franchise"],
      project_status: [
        "new",
        "measurement_done",
        "estimate_sent",
        "approved",
        "in_progress",
        "completed",
        "rejected",
      ],
    },
  },
} as const
