// Enhanced JSON type with better type safety
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Utility types for better database operations
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
export type Functions<T extends keyof Database['public']['Functions']> = Database['public']['Functions'][T]

// Convenience type aliases
export type Profile = Tables<'profiles'>
export type AuthActivity = Tables<'auth_activity'>
export type AccountSecurity = Tables<'account_security'>
export type Property = Tables<'properties'>
export type Booking = Tables<'bookings'>
export type Inquiry = Tables<'inquiries'>
export type Favorite = Tables<'favorites'>

// Insert and Update types for better form handling
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']
export type PropertyInsert = Database['public']['Tables']['properties']['Insert']
export type PropertyUpdate = Database['public']['Tables']['properties']['Update']

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          email: string
          phone_number: string | null
          role: 'user' | 'agent' | 'admin'
          avatar_url: string | null
          preferences: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          email: string
          phone_number?: string | null
          role?: 'user' | 'agent' | 'admin'
          avatar_url?: string | null
          preferences?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          email?: string
          phone_number?: string | null
          role?: 'user' | 'agent' | 'admin'
          avatar_url?: string | null
          preferences?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      auth_activity: {
        Row: {
          id: string
          user_id: string | null
          activity_type: 'sign_up' | 'sign_in' | 'sign_out' | 'password_change' | 'password_reset_request' | 'password_reset_complete' | 'email_verification_sent' | 'email_verified' | 'profile_update' | 'account_deleted' | 'failed_login' | 'suspicious_activity' | 'account_locked' | 'account_unlocked' | 'oauth_sign_in' | 'session_created' | 'session_expired' | 'security_violation' | 'rate_limit_exceeded' | 'ip_blocked' | 'oauth_failure' | 'session_refreshed' | 'session_terminated' | 'bulk_session_termination' | 'admin_alert_sent' | 'threat_detected' | 'location_change' | 'device_change' | 'password_breach_detected' | 'account_takeover_attempt' | 'security_notification_sent' | 'admin_intervention_required' | 'brute_force_detected' | 'ip_reputation_check' | 'device_reputation_check'
          ip_address: string | null
          user_agent: string | null
          location: Json | null
          device_fingerprint: string | null
          success: boolean
          failure_reason: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          activity_type: 'sign_up' | 'sign_in' | 'sign_out' | 'password_change' | 'password_reset_request' | 'password_reset_complete' | 'email_verification_sent' | 'email_verified' | 'profile_update' | 'account_deleted' | 'failed_login' | 'suspicious_activity' | 'account_locked' | 'account_unlocked' | 'oauth_sign_in' | 'session_created' | 'session_expired' | 'security_violation' | 'rate_limit_exceeded' | 'ip_blocked' | 'oauth_failure' | 'session_refreshed' | 'session_terminated' | 'bulk_session_termination' | 'admin_alert_sent' | 'threat_detected' | 'location_change' | 'device_change' | 'password_breach_detected' | 'account_takeover_attempt' | 'security_notification_sent' | 'admin_intervention_required' | 'brute_force_detected' | 'ip_reputation_check' | 'device_reputation_check'
          ip_address?: string | null
          user_agent?: string | null
          location?: Json | null
          device_fingerprint?: string | null
          success?: boolean
          failure_reason?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          activity_type?: 'sign_up' | 'sign_in' | 'sign_out' | 'password_change' | 'password_reset_request' | 'password_reset_complete' | 'email_verification_sent' | 'email_verified' | 'profile_update' | 'account_deleted' | 'failed_login' | 'suspicious_activity' | 'account_locked' | 'account_unlocked'
          ip_address?: string | null
          user_agent?: string | null
          location?: Json | null
          device_fingerprint?: string | null
          success?: boolean
          failure_reason?: string | null
          metadata?: Json
          created_at?: string
        }
      }
      email_verification_tokens: {
        Row: {
          id: string
          user_id: string | null
          email: string
          token_hash: string
          expires_at: string
          used_at: string | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          email: string
          token_hash: string
          expires_at: string
          used_at?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          email?: string
          token_hash?: string
          expires_at?: string
          used_at?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
      password_history: {
        Row: {
          id: string
          user_id: string | null
          password_hash: string
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          password_hash: string
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          password_hash?: string
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
      account_security: {
        Row: {
          user_id: string
          is_locked: boolean
          locked_at: string | null
          locked_reason: string | null
          failed_login_attempts: number
          last_failed_login_at: string | null
          two_factor_enabled: boolean
          two_factor_secret: string | null
          recovery_codes: string[] | null
          last_password_change: string | null
          password_expires_at: string | null
          suspicious_activity_score: number
          last_activity_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          is_locked?: boolean
          locked_at?: string | null
          locked_reason?: string | null
          failed_login_attempts?: number
          last_failed_login_at?: string | null
          two_factor_enabled?: boolean
          two_factor_secret?: string | null
          recovery_codes?: string[] | null
          last_password_change?: string | null
          password_expires_at?: string | null
          suspicious_activity_score?: number
          last_activity_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          is_locked?: boolean
          locked_at?: string | null
          locked_reason?: string | null
          failed_login_attempts?: number
          last_failed_login_at?: string | null
          two_factor_enabled?: boolean
          two_factor_secret?: string | null
          recovery_codes?: string[] | null
          last_password_change?: string | null
          password_expires_at?: string | null
          suspicious_activity_score?: number
          last_activity_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      properties: {
        Row: {
          id: string
          title_en: string
          title_ar: string | null
          description_en: string | null
          description_ar: string | null
          property_type: 'apartment' | 'villa' | 'land' | 'commercial'
          status: 'available' | 'sold' | 'rented' | 'under_offer'
          price: number
          area_sqm: number | null
          bedrooms: number | null
          bathrooms: number | null
          location: Json
          city: string
          district: string | null
          amenities: string[]
          images: string[]
          featured: boolean
          agent_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title_en: string
          title_ar?: string | null
          description_en?: string | null
          description_ar?: string | null
          property_type: 'apartment' | 'villa' | 'land' | 'commercial'
          status?: 'available' | 'sold' | 'rented' | 'under_offer'
          price: number
          area_sqm?: number | null
          bedrooms?: number | null
          bathrooms?: number | null
          location: Json
          city: string
          district?: string | null
          amenities?: string[]
          images?: string[]
          featured?: boolean
          agent_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title_en?: string
          title_ar?: string | null
          description_en?: string | null
          description_ar?: string | null
          property_type?: 'apartment' | 'villa' | 'land' | 'commercial'
          status?: 'available' | 'sold' | 'rented' | 'under_offer'
          price?: number
          area_sqm?: number | null
          bedrooms?: number | null
          bathrooms?: number | null
          location?: Json
          city?: string
          district?: string | null
          amenities?: string[]
          images?: string[]
          featured?: boolean
          agent_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      bookings: {
        Row: {
          id: string
          property_id: string
          user_id: string
          scheduled_date: string
          status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          property_id: string
          user_id: string
          scheduled_date: string
          status?: 'pending' | 'confirmed' | 'cancelled' | 'completed'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          property_id?: string
          user_id?: string
          scheduled_date?: string
          status?: 'pending' | 'confirmed' | 'cancelled' | 'completed'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      favorites: {
        Row: {
          user_id: string
          property_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          property_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          property_id?: string
          created_at?: string
        }
      }
      inquiries: {
        Row: {
          id: string
          property_id: string
          user_id: string
          message: string
          status: 'new' | 'responded' | 'closed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          property_id: string
          user_id: string
          message: string
          status?: 'new' | 'responded' | 'closed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          property_id?: string
          user_id?: string
          message?: string
          status?: 'new' | 'responded' | 'closed'
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      log_auth_activity: {
        Args: {
          p_user_id: string
          p_activity_type: string
          p_ip_address?: string
          p_user_agent?: string
          p_success?: boolean
          p_failure_reason?: string
          p_metadata?: Json
        }
        Returns: string
      }
      is_account_locked: {
        Args: {
          p_user_id: string
        }
        Returns: boolean
      }
      increment_failed_login_attempts: {
        Args: {
          p_user_id: string
        }
        Returns: number
      }
      reset_failed_login_attempts: {
        Args: {
          p_user_id: string
        }
        Returns: void
      }
      check_password_history: {
        Args: {
          p_user_id: string
          p_password_hash: string
          p_history_limit?: number
        }
        Returns: boolean
      }
      add_password_to_history: {
        Args: {
          p_user_id: string
          p_password_hash: string
          p_ip_address?: string
          p_user_agent?: string
        }
        Returns: string
      }
      cleanup_old_auth_data: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_current_user_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_current_user_agent: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      user_type: 'buyer' | 'seller' | 'agent' | 'admin'
      property_type: 'apartment' | 'villa' | 'land' | 'commercial'
      property_status: 'available' | 'sold' | 'rented' | 'under_offer'
      booking_status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
      inquiry_status: 'new' | 'responded' | 'closed'
      language: 'en' | 'ar'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Type guards for runtime type checking
export const isProfile = (obj: unknown): obj is Profile => {
  return typeof obj === 'object' && obj !== null && 
    'id' in obj && typeof (obj as any).id === 'string' &&
    'email' in obj && typeof (obj as any).email === 'string'
}

export const isProperty = (obj: unknown): obj is Property => {
  return typeof obj === 'object' && obj !== null && 
    'id' in obj && typeof (obj as any).id === 'string' &&
    'title_en' in obj && typeof (obj as any).title_en === 'string'
}

export const isAuthActivity = (obj: unknown): obj is AuthActivity => {
  return typeof obj === 'object' && obj !== null && 
    'id' in obj && typeof (obj as any).id === 'string' &&
    'activity_type' in obj && typeof (obj as any).activity_type === 'string'
}

// Utility type for database queries with better error handling
export interface DatabaseResult<T> {
  data: T | null
  error: Error | null
  count?: number
}

// Enhanced error type for database operations
export interface DatabaseError extends Error {
  code: string
  details: string
  hint: string
  message: string
}