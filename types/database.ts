export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ModuleType =
  | 'WORKBOOK'
  | 'VIDEO'
  | 'LIVE_CALL'
  | 'PERFORM'
  | 'SHADOW'
  | 'MANAGER_LED'
  | 'BAU'
  | 'LESSONLY'
  | 'PEER_PARTNER';

export type UserRole = 'Admin' | 'Manager' | 'New Hire';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: UserRole;
          avatar: string | null;
          title: string | null;
          region: string | null;
          location: string | null;
          standardized_role: string | null;
          manager_id: string | null;
          department: string | null;
          start_date: string | null;
          provisioned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          role?: UserRole;
          avatar?: string | null;
          title?: string | null;
          region?: string | null;
          location?: string | null;
          standardized_role?: string | null;
          manager_id?: string | null;
          department?: string | null;
          start_date?: string | null;
          provisioned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          role?: UserRole;
          avatar?: string | null;
          title?: string | null;
          region?: string | null;
          location?: string | null;
          standardized_role?: string | null;
          manager_id?: string | null;
          department?: string | null;
          start_date?: string | null;
          provisioned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      training_modules: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          type: ModuleType;
          duration: string | null;
          link: string | null;
          host: string | null;
          sort_order: number;
          target_role: string | null;
          day_offset: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          type: ModuleType;
          duration?: string | null;
          link?: string | null;
          host?: string | null;
          sort_order?: number;
          target_role?: string | null;
          day_offset?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          type?: ModuleType;
          duration?: string | null;
          link?: string | null;
          host?: string | null;
          sort_order?: number;
          target_role?: string | null;
          day_offset?: number;
          created_at?: string;
        };
      };
      user_modules: {
        Row: {
          id: string;
          user_id: string;
          module_id: string;
          completed: boolean;
          completed_at: string | null;
          due_date: string | null;
          score: number | null;
          liked: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          module_id: string;
          completed?: boolean;
          completed_at?: string | null;
          due_date?: string | null;
          score?: number | null;
          liked?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          module_id?: string;
          completed?: boolean;
          completed_at?: string | null;
          due_date?: string | null;
          score?: number | null;
          liked?: boolean;
          created_at?: string;
        };
      };
      okrs: {
        Row: {
          id: string;
          title: string;
          role_type: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          role_type?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          role_type?: string | null;
          created_at?: string;
        };
      };
      key_results: {
        Row: {
          id: string;
          okr_id: string;
          description: string;
          target: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          okr_id: string;
          description: string;
          target?: string | null;
          sort_order?: number;
        };
        Update: {
          id?: string;
          okr_id?: string;
          description?: string;
          target?: string | null;
          sort_order?: number;
        };
      };
      user_okrs: {
        Row: {
          id: string;
          user_id: string;
          okr_id: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          okr_id: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          okr_id?: string;
        };
      };
      manager_task_templates: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          due_date_offset: number;
          time_estimate: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          due_date_offset: number;
          time_estimate?: string | null;
          sort_order?: number;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          due_date_offset?: number;
          time_estimate?: string | null;
          sort_order?: number;
        };
      };
      user_manager_tasks: {
        Row: {
          id: string;
          manager_id: string;
          new_hire_id: string;
          template_id: string;
          completed: boolean;
          completed_at: string | null;
          due_date: string | null;
        };
        Insert: {
          id?: string;
          manager_id: string;
          new_hire_id: string;
          template_id: string;
          completed?: boolean;
          completed_at?: string | null;
          due_date?: string | null;
        };
        Update: {
          id?: string;
          manager_id?: string;
          new_hire_id?: string;
          template_id?: string;
          completed?: boolean;
          completed_at?: string | null;
          due_date?: string | null;
        };
      };
      shoutouts: {
        Row: {
          id: string;
          from_user_id: string;
          to_user_id: string;
          message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          from_user_id: string;
          to_user_id: string;
          message: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          from_user_id?: string;
          to_user_id?: string;
          message?: string;
          created_at?: string;
        };
      };
      workbook_responses: {
        Row: {
          id: string;
          user_id: string;
          prompt_key: string;
          response: string | null;
          manager_comment: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          prompt_key: string;
          response?: string | null;
          manager_comment?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          prompt_key?: string;
          response?: string | null;
          manager_comment?: string | null;
          updated_at?: string;
        };
      };
      module_comments: {
        Row: {
          id: string;
          module_id: string;
          user_id: string;
          text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          module_id: string;
          user_id: string;
          text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          module_id?: string;
          user_id?: string;
          text?: string;
          created_at?: string;
        };
      };
      cohorts: {
        Row: {
          id: string;
          name: string;
          hire_start_date: string;
          hire_end_date: string;
          starting_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          hire_start_date: string;
          hire_end_date: string;
          starting_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          hire_start_date?: string;
          hire_end_date?: string;
          starting_date?: string | null;
          created_at?: string;
        };
      };
      session_logs: {
        Row: {
          id: string;
          user_id: string;
          logged_in_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          logged_in_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          logged_in_at?: string;
        };
      };
      cohort_leaders: {
        Row: {
          id: string;
          cohort_id: string;
          role_label: string;
          region: string;
          profile_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          cohort_id: string;
          role_label: string;
          region: string;
          profile_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          cohort_id?: string;
          role_label?: string;
          region?: string;
          profile_id?: string;
          created_at?: string;
        };
      };
    };
      slack_messages: {
        Row: {
          id: string;
          sender_id: string;
          recipient_id: string;
          message_text: string;
          channel: string;
          sent_at: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          recipient_id: string;
          message_text: string;
          channel?: string;
          sent_at?: string;
        };
        Update: {
          id?: string;
          sender_id?: string;
          recipient_id?: string;
          message_text?: string;
          channel?: string;
          sent_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Convenience type aliases
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type TrainingModule = Database['public']['Tables']['training_modules']['Row'];
export type UserModule = Database['public']['Tables']['user_modules']['Row'];

export type Okr = Database['public']['Tables']['okrs']['Row'];
export type KeyResult = Database['public']['Tables']['key_results']['Row'];
export type UserOkr = Database['public']['Tables']['user_okrs']['Row'];

export type ManagerTaskTemplate = Database['public']['Tables']['manager_task_templates']['Row'];
export type UserManagerTask = Database['public']['Tables']['user_manager_tasks']['Row'];

export type Shoutout = Database['public']['Tables']['shoutouts']['Row'];
export type WorkbookResponse = Database['public']['Tables']['workbook_responses']['Row'];
export type ModuleComment = Database['public']['Tables']['module_comments']['Row'];

export type Cohort = Database['public']['Tables']['cohorts']['Row'];
export type CohortInsert = Database['public']['Tables']['cohorts']['Insert'];
export type CohortUpdate = Database['public']['Tables']['cohorts']['Update'];
export type CohortLeader = Database['public']['Tables']['cohort_leaders']['Row'];
export type CohortLeaderInsert = Database['public']['Tables']['cohort_leaders']['Insert'];
export type CohortWithLeaders = Cohort & { cohort_leaders: (CohortLeader & { profiles: Profile })[] };

export type SessionLog = Database['public']['Tables']['session_logs']['Row'];
export type SlackMessage = Database['public']['Tables']['slack_messages']['Row'];
export type SlackMessageInsert = Database['public']['Tables']['slack_messages']['Insert'];
