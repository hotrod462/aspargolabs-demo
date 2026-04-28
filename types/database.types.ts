export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/**
 * Lightweight DB typing to unblock compilation.
 * Replace with `npx supabase gen types typescript ... > types/database.types.ts`.
 */
export type Database = {
  public: {
    Tables: {
      call_sessions: {
        Row: {
          id: string;
          call_id: string;
          assistant_id: string | null;
          status: string;
          current_state: string;
          patient_phone: string | null;
          started_at: string;
          ended_at: string | null;
          completion_pct: number;
          hard_stop_reason: string | null;
          needs_review: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          call_id: string;
          assistant_id?: string | null;
          status?: string;
          current_state?: string;
          patient_phone?: string | null;
          started_at?: string;
          ended_at?: string | null;
          completion_pct?: number;
          hard_stop_reason?: string | null;
          needs_review?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          call_id?: string;
          assistant_id?: string | null;
          status?: string;
          current_state?: string;
          patient_phone?: string | null;
          started_at?: string;
          ended_at?: string | null;
          completion_pct?: number;
          hard_stop_reason?: string | null;
          needs_review?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      intake_fields: {
        Row: {
          id: string;
          session_id: string;
          field_key: string;
          value: string | null;
          status: string;
          confidence: number | null;
          source: string | null;
          evidence: string | null;
          confirmed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          field_key: string;
          value?: string | null;
          status?: string;
          confidence?: number | null;
          source?: string | null;
          evidence?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          field_key?: string;
          value?: string | null;
          status?: string;
          confidence?: number | null;
          source?: string | null;
          evidence?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      intake_events: {
        Row: {
          id: string;
          session_id: string;
          event_type: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          event_type: string;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          event_type?: string;
          payload?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      // Present in existing demo code; keep permissive until regenerated.
      todos: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
