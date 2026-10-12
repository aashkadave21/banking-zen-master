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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_number: string
          account_type: Database["public"]["Enums"]["account_type"]
          balance: number
          created_at: string
          customer_id: string
          has_open_dormancy_case: boolean
          has_open_loan: boolean
          id: string
          min_balance: number
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          account_number: string
          account_type: Database["public"]["Enums"]["account_type"]
          balance?: number
          created_at?: string
          customer_id: string
          has_open_dormancy_case?: boolean
          has_open_loan?: boolean
          id?: string
          min_balance?: number
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          account_number?: string
          account_type?: Database["public"]["Enums"]["account_type"]
          balance?: number
          created_at?: string
          customer_id?: string
          has_open_dormancy_case?: boolean
          has_open_loan?: boolean
          id?: string
          min_balance?: number
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: never
        }
        Relationships: []
      }
      beneficiaries: {
        Row: {
          account_number: string
          activated_at: string | null
          beneficiary_name: string
          cooling_off_until: string | null
          created_at: string
          customer_id: string
          id: string
          ifsc: string
          is_active: boolean
          nickname: string
          updated_at: string
        }
        Insert: {
          account_number: string
          activated_at?: string | null
          beneficiary_name: string
          cooling_off_until?: string | null
          created_at?: string
          customer_id: string
          id?: string
          ifsc: string
          is_active?: boolean
          nickname: string
          updated_at?: string
        }
        Update: {
          account_number?: string
          activated_at?: string | null
          beneficiary_name?: string
          cooling_off_until?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          ifsc?: string
          is_active?: boolean
          nickname?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "beneficiaries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          customer_id: string
          daily_limit: number
          id: string
          is_premium: boolean
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          transfer_limit: number
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          daily_limit?: number
          id?: string
          is_premium?: boolean
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          transfer_limit?: number
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          daily_limit?: number
          id?: string
          is_premium?: boolean
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          transfer_limit?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_case_reviews: {
        Row: {
          analyst_id: string
          case_id: string
          created_at: string
          decision: Database["public"]["Enums"]["case_status"]
          id: string
          remarks: string
        }
        Insert: {
          analyst_id: string
          case_id: string
          created_at?: string
          decision: Database["public"]["Enums"]["case_status"]
          id?: string
          remarks: string
        }
        Update: {
          analyst_id?: string
          case_id?: string
          created_at?: string
          decision?: Database["public"]["Enums"]["case_status"]
          id?: string
          remarks?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraud_case_reviews_analyst_id_fkey"
            columns: ["analyst_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_case_reviews_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "fraud_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_cases: {
        Row: {
          account_id: string
          assigned_analyst: string | null
          case_id: string
          created_at: string
          escalation_history: Json
          id: string
          risk_band: Database["public"]["Enums"]["risk_band"]
          risk_score: number
          status: Database["public"]["Enums"]["case_status"]
          transaction_id: string
          triggered_rules: Json
          updated_at: string
        }
        Insert: {
          account_id: string
          assigned_analyst?: string | null
          case_id: string
          created_at?: string
          escalation_history?: Json
          id?: string
          risk_band: Database["public"]["Enums"]["risk_band"]
          risk_score: number
          status?: Database["public"]["Enums"]["case_status"]
          transaction_id: string
          triggered_rules?: Json
          updated_at?: string
        }
        Update: {
          account_id?: string
          assigned_analyst?: string | null
          case_id?: string
          created_at?: string
          escalation_history?: Json
          id?: string
          risk_band?: Database["public"]["Enums"]["risk_band"]
          risk_score?: number
          status?: Database["public"]["Enums"]["case_status"]
          transaction_id?: string
          triggered_rules?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraud_cases_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_cases_assigned_analyst_fkey"
            columns: ["assigned_analyst"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_cases_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_rules: {
        Row: {
          code: string
          description: string
          enabled: boolean
          id: string
          name: string
          params: Json
          updated_at: string
          updated_by: string | null
          version: number
          weight: number
        }
        Insert: {
          code: string
          description: string
          enabled?: boolean
          id?: string
          name: string
          params?: Json
          updated_at?: string
          updated_by?: string | null
          version?: number
          weight: number
        }
        Update: {
          code?: string
          description?: string
          enabled?: boolean
          id?: string
          name?: string
          params?: Json
          updated_at?: string
          updated_by?: string | null
          version?: number
          weight?: number
        }
        Relationships: []
      }
      known_devices: {
        Row: {
          fingerprint: string
          first_seen: string
          id: string
          user_id: string
        }
        Insert: {
          fingerprint: string
          first_seen?: string
          id?: string
          user_id: string
        }
        Update: {
          fingerprint?: string
          first_seen?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "known_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_records: {
        Row: {
          customer_id: string
          decided_at: string | null
          id: string
          provider: string
          reference_no: string
          remarks: string | null
          status: Database["public"]["Enums"]["kyc_status"]
          submitted_at: string
        }
        Insert: {
          customer_id: string
          decided_at?: string | null
          id?: string
          provider?: string
          reference_no: string
          remarks?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          submitted_at?: string
        }
        Update: {
          customer_id?: string
          decided_at?: string | null
          id?: string
          provider?: string
          reference_no?: string
          remarks?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account_id: string | null
          amount: number
          balance_after: number | null
          created_at: string
          entry_type: string
          id: number
          ledger_code: string
          narration: string | null
          transaction_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          balance_after?: number | null
          created_at?: string
          entry_type: string
          id?: never
          ledger_code?: string
          narration?: string | null
          transaction_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          balance_after?: number | null
          created_at?: string
          entry_type?: string
          id?: never
          ledger_code?: string
          narration?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      login_events: {
        Row: {
          created_at: string
          device_fingerprint: string | null
          id: number
          identifier: string
          reason: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_fingerprint?: string | null
          id?: never
          identifier: string
          reason?: string | null
          success: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_fingerprint?: string | null
          id?: never
          identifier?: string
          reason?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "login_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      login_lockouts: {
        Row: {
          failed_count: number
          identifier: string
          locked_until: string | null
          updated_at: string
        }
        Insert: {
          failed_count?: number
          identifier: string
          locked_until?: string | null
          updated_at?: string
        }
        Update: {
          failed_count?: number
          identifier?: string
          locked_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          channel: string
          created_at: string
          id: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          id?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_challenges: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          max_attempts: number
          purpose: Database["public"]["Enums"]["otp_purpose"]
          subject_id: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          max_attempts?: number
          purpose: Database["public"]["Enums"]["otp_purpose"]
          subject_id?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          max_attempts?: number
          purpose?: Database["public"]["Enums"]["otp_purpose"]
          subject_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "otp_challenges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          full_name: string
          id: string
          mobile_no: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          full_name: string
          id: string
          mobile_no: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          full_name?: string
          id?: string
          mobile_no?: string
          updated_at?: string
        }
        Relationships: []
      }
      settlement_records: {
        Row: {
          id: string
          idempotency_key: string
          network: string
          outcome_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          submitted_at: string
          transaction_id: string
        }
        Insert: {
          id?: string
          idempotency_key: string
          network?: string
          outcome_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status: string
          submitted_at?: string
          transaction_id: string
        }
        Update: {
          id?: string
          idempotency_key?: string
          network?: string
          outcome_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          submitted_at?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_records_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          beneficiary_id: string | null
          created_at: string
          dest_account_id: string | null
          failure_reason: string | null
          id: string
          idempotency_key: string
          initiated_by: string
          original_transaction_id: string | null
          posted_at: string | null
          reference: string
          remarks: string | null
          risk_band: Database["public"]["Enums"]["risk_band"] | null
          risk_score: number | null
          source_account_id: string | null
          status: Database["public"]["Enums"]["txn_status"]
          triggered_rules: Json
          type: Database["public"]["Enums"]["transfer_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          beneficiary_id?: string | null
          created_at?: string
          dest_account_id?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          initiated_by: string
          original_transaction_id?: string | null
          posted_at?: string | null
          reference: string
          remarks?: string | null
          risk_band?: Database["public"]["Enums"]["risk_band"] | null
          risk_score?: number | null
          source_account_id?: string | null
          status?: Database["public"]["Enums"]["txn_status"]
          triggered_rules?: Json
          type: Database["public"]["Enums"]["transfer_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          beneficiary_id?: string | null
          created_at?: string
          dest_account_id?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          initiated_by?: string
          original_transaction_id?: string | null
          posted_at?: string | null
          reference?: string
          remarks?: string | null
          risk_band?: Database["public"]["Enums"]["risk_band"] | null
          risk_score?: number | null
          source_account_id?: string | null
          status?: Database["public"]["Enums"]["txn_status"]
          triggered_rules?: Json
          type?: Database["public"]["Enums"]["transfer_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_dest_account_id_fkey"
            columns: ["dest_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_original_transaction_id_fkey"
            columns: ["original_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_source_account_id_fkey"
            columns: ["source_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: never; Returns: boolean }
      my_customer_id: { Args: never; Returns: string }
    }
    Enums: {
      account_status:
        | "PendingKYC"
        | "Active"
        | "Frozen"
        | "Deactivated"
        | "Dormant"
      account_type: "Savings" | "Current"
      app_role:
        | "customer"
        | "premium_customer"
        | "bank_admin"
        | "fraud_analyst"
        | "auditor"
      case_status:
        | "Open"
        | "Escalated"
        | "UnderReview"
        | "ConfirmedFraud"
        | "FalsePositive"
        | "Closed"
      kyc_status: "Pending" | "Verified" | "Rejected"
      otp_purpose:
        | "Transfer"
        | "StepUp"
        | "Beneficiary"
        | "NewDevice"
        | "Deactivate"
      risk_band: "LOW" | "MEDIUM" | "HIGH"
      transfer_type: "Own" | "Beneficiary" | "Reversal"
      txn_status:
        | "Initiated"
        | "AwaitingOTP"
        | "Posted"
        | "Pending"
        | "Settled"
        | "Failed"
        | "Blocked"
        | "Cancelled"
        | "Reversed"
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
  public: {
    Enums: {
      account_status: [
        "PendingKYC",
        "Active",
        "Frozen",
        "Deactivated",
        "Dormant",
      ],
      account_type: ["Savings", "Current"],
      app_role: [
        "customer",
        "premium_customer",
        "bank_admin",
        "fraud_analyst",
        "auditor",
      ],
      case_status: [
        "Open",
        "Escalated",
        "UnderReview",
        "ConfirmedFraud",
        "FalsePositive",
        "Closed",
      ],
      kyc_status: ["Pending", "Verified", "Rejected"],
      otp_purpose: [
        "Transfer",
        "StepUp",
        "Beneficiary",
        "NewDevice",
        "Deactivate",
      ],
      risk_band: ["LOW", "MEDIUM", "HIGH"],
      transfer_type: ["Own", "Beneficiary", "Reversal"],
      txn_status: [
        "Initiated",
        "AwaitingOTP",
        "Posted",
        "Pending",
        "Settled",
        "Failed",
        "Blocked",
        "Cancelled",
        "Reversed",
      ],
    },
  },
} as const
