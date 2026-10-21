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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          content: string
          email_publication_id: string | null
          id: string
          image_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content: string
          email_publication_id?: string | null
          id?: string
          image_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          email_publication_id?: string | null
          id?: string
          image_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_rate_limits: {
        Row: {
          request_count: number
          scope: string
          user_id: string
          window_start: string
        }
        Insert: {
          request_count?: number
          scope: string
          user_id: string
          window_start: string
        }
        Update: {
          request_count?: number
          scope?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_disputes: {
        Row: {
          attendance_log_id: number | null
          claimed_time_in: string | null
          claimed_time_out: string | null
          created_at: string
          dispute_date: string
          dispute_type: string
          hr_notes: string | null
          id: string
          original_time_in: string | null
          original_time_out: string | null
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          attendance_log_id?: number | null
          claimed_time_in?: string | null
          claimed_time_out?: string | null
          created_at?: string
          dispute_date: string
          dispute_type?: string
          hr_notes?: string | null
          id?: string
          original_time_in?: string | null
          original_time_out?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attendance_log_id?: number | null
          claimed_time_in?: string | null
          claimed_time_out?: string | null
          created_at?: string
          dispute_date?: string
          dispute_type?: string
          hr_notes?: string | null
          id?: string
          original_time_in?: string | null
          original_time_out?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_disputes_attendance_log_id_fkey"
            columns: ["attendance_log_id"]
            isOneToOne: false
            referencedRelation: "attendance_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_disputes_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_disputes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_disputes_archive: {
        Row: {
          attendance_log_id: number | null
          claimed_time_in: string | null
          claimed_time_out: string | null
          created_at: string
          dispute_date: string
          dispute_type: string
          hr_notes: string | null
          id: string
          original_time_in: string | null
          original_time_out: string | null
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          attendance_log_id?: number | null
          claimed_time_in?: string | null
          claimed_time_out?: string | null
          created_at?: string
          dispute_date: string
          dispute_type?: string
          hr_notes?: string | null
          id?: string
          original_time_in?: string | null
          original_time_out?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attendance_log_id?: number | null
          claimed_time_in?: string | null
          claimed_time_out?: string | null
          created_at?: string
          dispute_date?: string
          dispute_type?: string
          hr_notes?: string | null
          id?: string
          original_time_in?: string | null
          original_time_out?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      attendance_logs: {
        Row: {
          absent_offset_minutes: number
          created_at: string | null
          early_out_offset_minutes: number
          id: number
          late_offset_minutes: number
          log_date: string
          status: string
          time_in: string | null
          time_out: string | null
          user_id: string
        }
        Insert: {
          absent_offset_minutes?: number
          created_at?: string | null
          early_out_offset_minutes?: number
          id?: number
          late_offset_minutes?: number
          log_date?: string
          status?: string
          time_in?: string | null
          time_out?: string | null
          user_id: string
        }
        Update: {
          absent_offset_minutes?: number
          created_at?: string | null
          early_out_offset_minutes?: number
          id?: number
          late_offset_minutes?: number
          log_date?: string
          status?: string
          time_in?: string | null
          time_out?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_logs_archive: {
        Row: {
          created_at: string | null
          id: number
          log_date: string
          status: string
          time_in: string | null
          time_out: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          log_date?: string
          status?: string
          time_in?: string | null
          time_out?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: number
          log_date?: string
          status?: string
          time_in?: string | null
          time_out?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          summary: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          summary: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      early_out_offset_requests: {
        Row: {
          attendance_log_id: number
          created_at: string
          cutoff_hour: number
          hr_notes: string | null
          id: string
          required_minutes: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          attendance_log_id: number
          created_at?: string
          cutoff_hour: number
          hr_notes?: string | null
          id?: string
          required_minutes: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attendance_log_id?: number
          created_at?: string
          cutoff_hour?: number
          hr_notes?: string | null
          id?: string
          required_minutes?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "early_out_offset_requests_attendance_log_id_fkey"
            columns: ["attendance_log_id"]
            isOneToOne: false
            referencedRelation: "attendance_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "early_out_offset_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "early_out_offset_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          category: string
          created_by: string | null
          file_name: string
          file_path: string
          id: string
          is_active: boolean
          published_at: string
          title: string
        }
        Insert: {
          category?: string
          created_by?: string | null
          file_name: string
          file_path: string
          id?: string
          is_active?: boolean
          published_at?: string
          title: string
        }
        Update: {
          category?: string
          created_by?: string | null
          file_name?: string
          file_path?: string
          id?: string
          is_active?: boolean
          published_at?: string
          title?: string
        }
        Relationships: []
      }
      employee_government_ids: {
        Row: {
          employment_status: string | null
          hired_date: string | null
          id: string
          pagibig_number: string | null
          philhealth_number: string | null
          sss_number: string | null
          tin_number: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          employment_status?: string | null
          hired_date?: string | null
          id?: string
          pagibig_number?: string | null
          philhealth_number?: string | null
          sss_number?: string | null
          tin_number?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          employment_status?: string | null
          hired_date?: string | null
          id?: string
          pagibig_number?: string | null
          philhealth_number?: string | null
          sss_number?: string | null
          tin_number?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_government_ids_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_government_ids_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_support_requests: {
        Row: {
          category: string
          created_at: string
          description: string
          hr_notes: string | null
          id: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          hr_notes?: string | null
          id?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          hr_notes?: string | null
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          created_at: string
          created_by: string | null
          holiday_date: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          holiday_date: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          holiday_date?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "holidays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_credits: {
        Row: {
          id: string
          total_credits: number
          used_credits: number
          user_id: string
          year: number
        }
        Insert: {
          id?: string
          total_credits?: number
          used_credits?: number
          user_id: string
          year: number
        }
        Update: {
          id?: string
          total_credits?: number
          used_credits?: number
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_request_days: {
        Row: {
          created_at: string
          id: string
          leave_date: string
          leave_request_id: string
          resolved_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          leave_date: string
          leave_request_id: string
          resolved_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          leave_date?: string
          leave_request_id?: string
          resolved_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_request_days_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_request_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_request_days_archive: {
        Row: {
          created_at: string
          id: string
          leave_date: string
          leave_request_id: string
          resolved_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          leave_date: string
          leave_request_id: string
          resolved_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          leave_date?: string
          leave_request_id?: string
          resolved_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          created_at: string
          end_date: string
          funding_source: string
          hr_notes: string | null
          id: string
          lead_approval_status: string
          lead_approver_id: string | null
          lead_notes: string | null
          lead_reviewed_at: string | null
          leave_type: string
          offset_charged_at: string | null
          offset_minutes_required: number
          offset_refunded_at: string | null
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          funding_source?: string
          hr_notes?: string | null
          id?: string
          lead_approval_status?: string
          lead_approver_id?: string | null
          lead_notes?: string | null
          lead_reviewed_at?: string | null
          leave_type: string
          offset_charged_at?: string | null
          offset_minutes_required?: number
          offset_refunded_at?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          funding_source?: string
          hr_notes?: string | null
          id?: string
          lead_approval_status?: string
          lead_approver_id?: string | null
          lead_notes?: string | null
          lead_reviewed_at?: string | null
          leave_type?: string
          offset_charged_at?: string | null
          offset_minutes_required?: number
          offset_refunded_at?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_lead_approver_id_fkey"
            columns: ["lead_approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests_archive: {
        Row: {
          created_at: string
          end_date: string
          hr_notes: string | null
          id: string
          leave_type: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          hr_notes?: string | null
          id?: string
          leave_type: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          hr_notes?: string | null
          id?: string
          leave_type?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      manpower_cutoff_snapshots: {
        Row: {
          created_at: string
          cutoff_at: string
          project_id: string | null
          user_id: string
          work_date: string
        }
        Insert: {
          created_at?: string
          cutoff_at: string
          project_id?: string | null
          user_id: string
          work_date: string
        }
        Update: {
          created_at?: string
          cutoff_at?: string
          project_id?: string | null
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "manpower_cutoff_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "manpower_project_hours_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "manpower_cutoff_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "manpower_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manpower_cutoff_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manpower_lunch_pauses: {
        Row: {
          created_at: string
          id: string
          lunch_date: string
          paused_at: string
          project_id: string
          resumed_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lunch_date: string
          paused_at: string
          project_id: string
          resumed_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lunch_date?: string
          paused_at?: string
          project_id?: string
          resumed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manpower_lunch_pauses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "manpower_project_hours_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "manpower_lunch_pauses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "manpower_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manpower_lunch_pauses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manpower_projects: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          project_code: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          project_code?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          project_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manpower_projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manpower_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          offset_request_id: string | null
          project_id: string
          source: string
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          offset_request_id?: string | null
          project_id: string
          source?: string
          started_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          offset_request_id?: string | null
          project_id?: string
          source?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manpower_sessions_offset_request_id_fkey"
            columns: ["offset_request_id"]
            isOneToOne: true
            referencedRelation: "offset_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manpower_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "manpower_project_hours_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "manpower_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "manpower_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manpower_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manpower_time_adjustments: {
        Row: {
          created_at: string
          created_by: string
          delta_minutes: number
          id: string
          project_id: string
          reason: string
          transfer_id: string | null
          user_id: string
          work_date: string
        }
        Insert: {
          created_at?: string
          created_by: string
          delta_minutes: number
          id?: string
          project_id: string
          reason: string
          transfer_id?: string | null
          user_id: string
          work_date: string
        }
        Update: {
          created_at?: string
          created_by?: string
          delta_minutes?: number
          id?: string
          project_id?: string
          reason?: string
          transfer_id?: string | null
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "manpower_time_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manpower_time_adjustments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "manpower_project_hours_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "manpower_time_adjustments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "manpower_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manpower_time_adjustments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offset_requests: {
        Row: {
          attendance_log_id: number
          created_at: string
          eligible_hours: number
          hr_notes: string | null
          id: string
          manpower_ot_end_at: string | null
          manpower_ot_start_at: string | null
          manpower_project_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scheduled_end_at: string
          status: string
          time_out_at: string
          user_id: string
        }
        Insert: {
          attendance_log_id: number
          created_at?: string
          eligible_hours: number
          hr_notes?: string | null
          id?: string
          manpower_ot_end_at?: string | null
          manpower_ot_start_at?: string | null
          manpower_project_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_end_at: string
          status?: string
          time_out_at: string
          user_id: string
        }
        Update: {
          attendance_log_id?: number
          created_at?: string
          eligible_hours?: number
          hr_notes?: string | null
          id?: string
          manpower_ot_end_at?: string | null
          manpower_ot_start_at?: string | null
          manpower_project_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_end_at?: string
          status?: string
          time_out_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offset_requests_attendance_log_id_fkey"
            columns: ["attendance_log_id"]
            isOneToOne: true
            referencedRelation: "attendance_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offset_requests_manpower_project_id_fkey"
            columns: ["manpower_project_id"]
            isOneToOne: false
            referencedRelation: "manpower_project_hours_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "offset_requests_manpower_project_id_fkey"
            columns: ["manpower_project_id"]
            isOneToOne: false
            referencedRelation: "manpower_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offset_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offset_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offset_transactions: {
        Row: {
          created_at: string
          created_by: string | null
          hours: number
          id: string
          kind: string
          leave_request_id: string | null
          minutes: number
          note: string | null
          offset_request_id: string | null
          source: string
          usage_date: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          hours: number
          id?: string
          kind: string
          leave_request_id?: string | null
          minutes?: number
          note?: string | null
          offset_request_id?: string | null
          source?: string
          usage_date?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          hours?: number
          id?: string
          kind?: string
          leave_request_id?: string | null
          minutes?: number
          note?: string | null
          offset_request_id?: string | null
          source?: string
          usage_date?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offset_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offset_transactions_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offset_transactions_offset_request_id_fkey"
            columns: ["offset_request_id"]
            isOneToOne: false
            referencedRelation: "offset_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offset_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offset_usage_requests: {
        Row: {
          attendance_log_id: number
          created_at: string
          hours: number
          hr_notes: string | null
          id: string
          required_minutes: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          usage_type: string
          user_id: string
        }
        Insert: {
          attendance_log_id: number
          created_at?: string
          hours?: number
          hr_notes?: string | null
          id?: string
          required_minutes?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          usage_type?: string
          user_id: string
        }
        Update: {
          attendance_log_id?: number
          created_at?: string
          hours?: number
          hr_notes?: string | null
          id?: string
          required_minutes?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          usage_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offset_usage_requests_attendance_log_id_fkey"
            columns: ["attendance_log_id"]
            isOneToOne: false
            referencedRelation: "attendance_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offset_usage_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offset_usage_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          acknowledged_at: string | null
          cutoff_label: string
          cutoff_period: string
          file_name: string
          file_path: string
          id: string
          published: boolean
          published_at: string | null
          uploaded_at: string
          uploaded_by: string | null
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          cutoff_label: string
          cutoff_period: string
          file_name: string
          file_path: string
          id?: string
          published?: boolean
          published_at?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          cutoff_label?: string
          cutoff_period?: string
          file_name?: string
          file_path?: string
          id?: string
          published?: boolean
          published_at?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslips_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          designation: string | null
          direct_lead_id: string | null
          employee_email: string | null
          employee_id: string | null
          employee_rank: string | null
          full_name: string | null
          id: string
          is_active: boolean
          resigned_date: string | null
          role: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          designation?: string | null
          direct_lead_id?: string | null
          employee_email?: string | null
          employee_id?: string | null
          employee_rank?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          resigned_date?: string | null
          role?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          designation?: string | null
          direct_lead_id?: string | null
          employee_email?: string | null
          employee_id?: string | null
          employee_rank?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          resigned_date?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_direct_lead_id_fkey"
            columns: ["direct_lead_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_advisories: {
        Row: {
          advisory_date: string
          apparent_temperature_c: number | null
          commute_window: string | null
          created_at: string
          generated_at: string
          headline: string
          id: string
          is_active: boolean
          location_name: string
          message: string
          precipitation_probability: number | null
          raw_weather: Json | null
          severity: string
          source_name: string | null
          temperature_c: number | null
          updated_at: string
          weather_code: number | null
          wind_speed_kmh: number | null
        }
        Insert: {
          advisory_date?: string
          apparent_temperature_c?: number | null
          commute_window?: string | null
          created_at?: string
          generated_at?: string
          headline: string
          id?: string
          is_active?: boolean
          location_name: string
          message: string
          precipitation_probability?: number | null
          raw_weather?: Json | null
          severity?: string
          source_name?: string | null
          temperature_c?: number | null
          updated_at?: string
          weather_code?: number | null
          wind_speed_kmh?: number | null
        }
        Update: {
          advisory_date?: string
          apparent_temperature_c?: number | null
          commute_window?: string | null
          created_at?: string
          generated_at?: string
          headline?: string
          id?: string
          is_active?: boolean
          location_name?: string
          message?: string
          precipitation_probability?: number | null
          raw_weather?: Json | null
          severity?: string
          source_name?: string | null
          temperature_c?: number | null
          updated_at?: string
          weather_code?: number | null
          wind_speed_kmh?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      manpower_project_hours_summary: {
        Row: {
          is_active: boolean | null
          project_code: string | null
          project_id: string | null
          project_name: string | null
          total_hours: number | null
          total_minutes: number | null
        }
        Relationships: []
      }
      manpower_total_hours_summary: {
        Row: {
          total_hours: number | null
          total_minutes: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      acknowledge_my_payslip: {
        Args: { p_payslip_id: string }
        Returns: undefined
      }
      adjust_manpower_time: {
        Args: {
          p_delta_minutes: number
          p_project_id: string
          p_reason: string
          p_user_id: string
          p_work_date: string
        }
        Returns: string
      }
      adjust_offset_balance: {
        Args: { p_delta_hours: number; p_reason: string; p_user_id: string }
        Returns: undefined
      }
      adjust_offset_balance_minutes: {
        Args: { p_delta_minutes: number; p_reason: string; p_user_id: string }
        Returns: undefined
      }
      apply_offset_to_late: {
        Args: { p_attendance_log_id: number }
        Returns: undefined
      }
      archive_old_records: {
        Args: never
        Returns: {
          archived_attendance_logs: number
          archived_disputes: number
          archived_leave_request_days: number
          archived_leave_requests: number
        }[]
      }
      cancel_approved_leave_as_hr: {
        Args: { p_leave_request_id: string }
        Returns: undefined
      }
      cancel_my_attendance_dispute: {
        Args: { p_dispute_id: string }
        Returns: undefined
      }
      cancel_my_offset_leave: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      close_manpower_at_daily_cutoff: { Args: never; Returns: undefined }
      compute_attendance_status: { Args: { p_at?: string }; Returns: string }
      consume_api_rate_limit: {
        Args: {
          p_limit: number
          p_scope: string
          p_user_id: string
          p_window_seconds: number
        }
        Returns: boolean
      }
      convert_offset_to_paid_leave: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      email_exists: { Args: { check_email: string }; Returns: boolean }
      generate_leave_request_days: {
        Args: { p_leave_request_id: string }
        Returns: undefined
      }
      get_employee_roster: {
        Args: { p_mode?: string }
        Returns: {
          avatar_url: string
          designation: string
          direct_lead_id: string
          employee_email: string
          employee_id: string
          employee_rank: string
          full_name: string
          id: string
          is_active: boolean
          resigned_date: string
        }[]
      }
      get_hr_offset_balances: {
        Args: never
        Returns: {
          approved_minutes: number
          available_minutes: number
          employee_id: string
          full_name: string
          reserved_minutes: number
          user_id: string
        }[]
      }
      is_hr: { Args: never; Returns: boolean }
      log_audit_event: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_summary: string
        }
        Returns: undefined
      }
      pause_manpower_for_lunch: { Args: never; Returns: undefined }
      record_early_out_with_offset: {
        Args: { p_cutoff_hour: number; p_user_id: string }
        Returns: {
          request_id: string
          required_minutes: number
          time_out: string
        }[]
      }
      reinstate_employee: { Args: { p_user_id: string }; Returns: undefined }
      release_holiday_absences: { Args: { p_date: string }; Returns: number }
      resign_employee: {
        Args: { p_last_day: string; p_user_id: string }
        Returns: number
      }
      resume_manpower_after_lunch: { Args: never; Returns: undefined }
      review_early_out_offset_request: {
        Args: { p_approve: boolean; p_notes?: string; p_request_id: string }
        Returns: undefined
      }
      review_offset_request: {
        Args: { p_approve: boolean; p_notes?: string; p_request_id: string }
        Returns: undefined
      }
      review_offset_usage_request: {
        Args: { p_approve: boolean; p_notes?: string; p_request_id: string }
        Returns: undefined
      }
      review_team_leave_request: {
        Args: { p_approve: boolean; p_notes?: string; p_request_id: string }
        Returns: undefined
      }
      set_employee_leave_hierarchy: {
        Args: {
          p_direct_lead_id?: string
          p_employee_id: string
          p_rank: string
        }
        Returns: undefined
      }
      settle_leave_day: {
        Args: { p_leave_date: string; p_user_id: string }
        Returns: undefined
      }
      settle_overdue_absences: { Args: never; Returns: undefined }
      settle_overdue_leave_days: { Args: never; Returns: undefined }
      stop_manpower_tracking: { Args: never; Returns: undefined }
      submit_early_out_offset_request: {
        Args: { p_attendance_log_id: number }
        Returns: string
      }
      submit_offset_usage_request: {
        Args: { p_attendance_log_id: number }
        Returns: string
      }
      switch_manpower_project: {
        Args: { p_project_id: string }
        Returns: string
      }
      transfer_manpower_time: {
        Args: {
          p_destination_project_id: string
          p_minutes: number
          p_reason: string
          p_source_project_id: string
          p_user_id: string
          p_work_date: string
        }
        Returns: string
      }
    }
    Enums: {
      user_role: "super_admin" | "hr" | "employee"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      user_role: ["super_admin", "hr", "employee"],
    },
  },
} as const
