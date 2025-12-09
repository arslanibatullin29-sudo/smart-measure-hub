// Типы для таблиц Supabase будут генерироваться автоматически
// Пока используем базовые типы

export interface Database {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string
          user_id: string
          full_name: string
          address: string
          phone: string
          comment: string
          created_at: string
          updated_at: string
          last_synced_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['customers']['Insert']>
      }
      projects: {
        Row: {
          id: string
          customer_id: string
          user_id: string
          created_at: string
          updated_at: string
          last_synced_at: string | null
          points: Array<{ x: number; y: number }>
          area: number
          perimeter: number
          element_count: number
          estimate_data: any
        }
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['projects']['Insert']>
      }
      installation_profiles: {
        Row: {
          id: string
          user_id: string
          name: string
          created_at: string
          updated_at: string
          last_synced_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['installation_profiles']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['installation_profiles']['Insert']>
      }
      materials: {
        Row: {
          id: string
          profile_id: string
          user_id: string
          name: string
          unit: string
          price: number
          calculation_type: 'byArea' | 'byPerimeter' | 'byCount'
          coefficient: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['materials']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['materials']['Insert']>
      }
      works: {
        Row: {
          id: string
          profile_id: string
          user_id: string
          name: string
          unit: string
          work_price: number
          calculation_type: 'byArea' | 'byPerimeter' | 'byCount'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['works']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['works']['Insert']>
      }
      work_materials: {
        Row: {
          id: string
          work_id: string
          material_id: string
          quantity: number
          calculation_override: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['work_materials']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['work_materials']['Insert']>
      }
    }
  }
}

