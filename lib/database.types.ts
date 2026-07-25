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
      activity: {
        Row: {
          anilist_id: number | null
          created_at: string
          id: string
          score: number | null
          target_user: string | null
          type: Database["public"]["Enums"]["activity_type"]
          user_id: string
        }
        Insert: {
          anilist_id?: number | null
          created_at?: string
          id?: string
          score?: number | null
          target_user?: string | null
          type: Database["public"]["Enums"]["activity_type"]
          user_id: string
        }
        Update: {
          anilist_id?: number | null
          created_at?: string
          id?: string
          score?: number | null
          target_user?: string | null
          type?: Database["public"]["Enums"]["activity_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_anilist_id_fkey"
            columns: ["anilist_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["anilist_id"]
          },
          {
            foreignKeyName: "activity_target_user_fkey"
            columns: ["target_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      anime: {
        Row: {
          anilist_id: number
          average_score: number | null
          banner_image_url: string | null
          cover_image_url: string | null
          description: string | null
          duration: number | null
          episodes: number | null
          format: string | null
          genres: string[]
          season: string | null
          season_year: number | null
          status: string | null
          synced_at: string
          title_english: string | null
          title_native: string | null
          title_romaji: string | null
        }
        Insert: {
          anilist_id: number
          average_score?: number | null
          banner_image_url?: string | null
          cover_image_url?: string | null
          description?: string | null
          duration?: number | null
          episodes?: number | null
          format?: string | null
          genres?: string[]
          season?: string | null
          season_year?: number | null
          status?: string | null
          synced_at?: string
          title_english?: string | null
          title_native?: string | null
          title_romaji?: string | null
        }
        Update: {
          anilist_id?: number
          average_score?: number | null
          banner_image_url?: string | null
          cover_image_url?: string | null
          description?: string | null
          duration?: number | null
          episodes?: number | null
          format?: string | null
          genres?: string[]
          season?: string | null
          season_year?: number | null
          status?: string | null
          synced_at?: string
          title_english?: string | null
          title_native?: string | null
          title_romaji?: string | null
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          is_private: boolean
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_private?: boolean
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_private?: boolean
          username?: string | null
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          anilist_id: number
          created_at: string
          from_user: string
          id: string
          note: string | null
          to_user: string
        }
        Insert: {
          anilist_id: number
          created_at?: string
          from_user: string
          id?: string
          note?: string | null
          to_user: string
        }
        Update: {
          anilist_id?: number
          created_at?: string
          from_user?: string
          id?: string
          note?: string | null
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_anilist_id_fkey"
            columns: ["anilist_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["anilist_id"]
          },
          {
            foreignKeyName: "recommendations_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_to_user_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_anime: {
        Row: {
          anilist_id: number
          created_at: string
          id: string
          note: string | null
          rank_position: number | null
          score: number | null
          sentiment: Database["public"]["Enums"]["sentiment"] | null
          status: Database["public"]["Enums"]["anime_status"]
          tags: string[]
          updated_at: string
          user_id: string
          watched_at: string | null
        }
        Insert: {
          anilist_id: number
          created_at?: string
          id?: string
          note?: string | null
          rank_position?: number | null
          score?: number | null
          sentiment?: Database["public"]["Enums"]["sentiment"] | null
          status: Database["public"]["Enums"]["anime_status"]
          tags?: string[]
          updated_at?: string
          user_id: string
          watched_at?: string | null
        }
        Update: {
          anilist_id?: number
          created_at?: string
          id?: string
          note?: string | null
          rank_position?: number | null
          score?: number | null
          sentiment?: Database["public"]["Enums"]["sentiment"] | null
          status?: Database["public"]["Enums"]["anime_status"]
          tags?: string[]
          updated_at?: string
          user_id?: string
          watched_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_anime_anilist_id_fkey"
            columns: ["anilist_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["anilist_id"]
          },
          {
            foreignKeyName: "user_anime_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_user: { Args: { p_user: string }; Returns: boolean }
      log_activity: {
        Args: {
          p_anilist_id?: number
          p_score?: number
          p_target_user?: string
          p_type: Database["public"]["Enums"]["activity_type"]
          p_user_id: string
        }
        Returns: undefined
      }
      recompute_user_ranking: { Args: never; Returns: undefined }
      remove_anime: { Args: { p_anilist_id: number }; Returns: undefined }
      sentiment_order: {
        Args: { s: Database["public"]["Enums"]["sentiment"] }
        Returns: number
      }
      set_anime_rank: {
        Args: {
          p_anilist_id: number
          p_bucket_index: number
          p_sentiment: Database["public"]["Enums"]["sentiment"]
        }
        Returns: {
          anilist_id: number
          created_at: string
          id: string
          note: string | null
          rank_position: number | null
          score: number | null
          sentiment: Database["public"]["Enums"]["sentiment"] | null
          status: Database["public"]["Enums"]["anime_status"]
          tags: string[]
          updated_at: string
          user_id: string
          watched_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "user_anime"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_anime_status: {
        Args: {
          p_anilist_id: number
          p_status: Database["public"]["Enums"]["anime_status"]
        }
        Returns: {
          anilist_id: number
          created_at: string
          id: string
          note: string | null
          rank_position: number | null
          score: number | null
          sentiment: Database["public"]["Enums"]["sentiment"] | null
          status: Database["public"]["Enums"]["anime_status"]
          tags: string[]
          updated_at: string
          user_id: string
          watched_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "user_anime"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      activity_type: "ranked" | "want" | "followed" | "recommended"
      anime_status: "watched" | "watching" | "want"
      sentiment: "liked" | "ok" | "disliked"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_type: ["ranked", "want", "followed", "recommended"],
      anime_status: ["watched", "watching", "want"],
      sentiment: ["liked", "ok", "disliked"],
    },
  },
} as const
