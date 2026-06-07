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
          comment: string
          created_at: string
          full_name: string
          id: string
          last_synced_at: string | null
          phone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string
          comment?: string
          created_at?: string
          full_name: string
          id?: string
          last_synced_at?: string | null
          phone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          comment?: string
          created_at?: string
          full_name?: string
          id?: string
          last_synced_at?: string | null
          phone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      installation_profiles: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          last_synced_at: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          last_synced_at?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          last_synced_at?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          calculation_type: string
          coefficient: number
          created_at: string
          id: string
          initial_quantity: number | null
          name: string
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
          id?: string
          initial_quantity?: number | null
          name: string
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
          id?: string
          initial_quantity?: number | null
          name?: string
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
            foreignKeyName: "materials_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "installation_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          area: number
          created_at: string
          customer_id: string | null
          element_count: number
          estimate_data: Json | null
          id: string
          last_synced_at: string | null
          perimeter: number
          points: Json
          profile_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          area?: number
          created_at?: string
          customer_id?: string | null
          element_count?: number
          estimate_data?: Json | null
          id?: string
          last_synced_at?: string | null
          perimeter?: number
          points?: Json
          profile_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: number
          created_at?: string
          customer_id?: string | null
          element_count?: number
          estimate_data?: Json | null
          id?: string
          last_synced_at?: string | null
          perimeter?: number
          points?: Json
          profile_id?: string | null
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
          id: string
          name: string
          profile_id: string
          unit: string
          updated_at: string
          user_id: string
          work_price: number
        }
        Insert: {
          calculation_type?: string
          created_at?: string
          id?: string
          name: string
          profile_id: string
          unit?: string
          updated_at?: string
          user_id: string
          work_price?: number
        }
        Update: {
          calculation_type?: string
          created_at?: string
          id?: string
          name?: string
          profile_id?: string
          unit?: string
          updated_at?: string
          user_id?: string
          work_price?: number
        }
        Relationships: [
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
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
