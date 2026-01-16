// ============================================================
// 👥 Tabla puente: announcement_audience_roles
// ============================================================

export interface AnnouncementAudienceRole {
  announcement_id: number; // FK → announcements.id
  role_id: number;         // FK → roles.id
}
