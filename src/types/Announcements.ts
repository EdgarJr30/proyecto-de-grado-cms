export type AnnouncementLevel = 'info' | 'warning' | 'danger' | 'success';

export interface Announcement {
  id: number;                         // BIGINT
  message: string;                     // Texto del anuncio
  level: AnnouncementLevel;            // info | warning | danger | success
  url?: string | null;                 // Link opcional
  is_active: boolean;                  // Switch general
  dismissible: boolean;                // Si el usuario puede cerrarlo
  starts_at?: string | null;           // TIMESTAMPTZ ISO string
  ends_at?: string | null;             // TIMESTAMPTZ ISO string o null
  audience_all: boolean;               // true: todos los roles; false: roles específicos
  created_at: string;                  // TIMESTAMPTZ ISO string
  updated_at: string;                  // TIMESTAMPTZ ISO string
  created_by?: string | null;          // UUID
  updated_by?: string | null;          // UUID
}

// ============================================================
// ✏️ Input para crear o actualizar anuncios
// ============================================================

export interface AnnouncementInput {
  message: string;
  level?: AnnouncementLevel;
  url?: string | null;
  is_active?: boolean;
  dismissible?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  audience_all?: boolean;
  audience_roles?: number[]; // IDs de roles si audience_all = false
}
