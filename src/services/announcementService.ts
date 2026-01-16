import { supabase } from "../lib/supabaseClient";
import type { Announcement, AnnouncementInput } from "../types/Announcements";
import type {AnnouncementAudienceRole} from "../types/AnnouncementAudienceRole";

// Helper genérico para convertir unknown a Error
function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  try {
    return new Error(JSON.stringify(e));
  } catch {
    return new Error(String(e));
  }
}

// Lectura pública (visible según RLS + helpers del backend)
export async function getPublicAnnouncements(params?: {
  from?: number; // índice inicial para paginación con range
  limit?: number; // cantidad de filas
  orderBy?: keyof Pick<Announcement, "starts_at" | "created_at" | "updated_at">;
  ascending?: boolean;
}): Promise<{ data: Announcement[] | null; error: Error | null }> {
  const from = params?.from ?? 0;
  const limit = params?.limit ?? 20;
  const orderBy = params?.orderBy ?? "starts_at";
  const ascending = params?.ascending ?? false;

  try {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order(orderBy, { ascending })
      .range(from, from + limit - 1);

    if (error) return { data: null, error: new Error(error.message) };
    return { data: (data ?? []) as Announcement[], error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}

//  Lectura de gestión (requiere permisos announcements:read o full_access)
export interface AdminListParams {
  search?: string; // por message
  onlyActive?: boolean; // filtra por is_active
  includeFuture?: boolean; // si false, filtra por starts_at <= now()
  includeExpired?: boolean; // si false, filtra por ends_at IS NULL OR now() < ends_at
  from?: number;
  limit?: number;
  orderBy?: keyof Pick<Announcement, "starts_at" | "created_at" | "updated_at">;
  ascending?: boolean;
}

export async function getAllAnnouncementsForAdmin(params?: AdminListParams): Promise<{
  data: Announcement[] | null;
  error: Error | null;
}> {
  const {
    search,
    onlyActive,
    includeFuture = true,
    includeExpired = true,
    from = 0,
    limit = 50,
    orderBy = "updated_at",
    ascending = false,
  } = params ?? {};

  try {
    let query = supabase.from("announcements").select("*");

    if (search && search.trim().length >= 2) {
      // Búsqueda simple por message (puedes ampliar con ilike en más columnas)
      query = query.ilike("message", `%${search.trim()}%`);
    }

    if (onlyActive === true) {
      query = query.eq("is_active", true);
    }

    // Filtros de tiempo (opcionales). Nota: la visibilidad real la controla RLS; esto es para UX.
    if (!includeFuture) {
      query = query.lte("starts_at", new Date().toISOString());
    }
    if (!includeExpired) {
      // ends_at IS NULL OR now() < ends_at
      query = query.or(
        `ends_at.is.null,ends_at.gt.${new Date().toISOString()}`
      );
    }

    const { data, error } = await query
      .order(orderBy, { ascending })
      .range(from, from + limit - 1);

    if (error) return { data: null, error: new Error(error.message) };
    return { data: (data ?? []) as Announcement[], error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}

// Crear anuncio + set de audiencia de roles (solo full_access)
export async function createAnnouncement(input: AnnouncementInput): Promise<{
  data: Announcement | null;
  error: Error | null;
}> {
  const payload = {
    message: input.message,
    level: input.level ?? "info",
    url: input.url ?? null,
    is_active: input.is_active ?? true,
    dismissible: input.dismissible ?? true,
    starts_at: input.starts_at ?? null,
    ends_at: input.ends_at ?? null,
    audience_all: input.audience_all ?? true,
  } satisfies Omit<Announcement, "id" | "created_at" | "updated_at" | "created_by" | "updated_by">;

  try {
    const { data, error } = await supabase
      .from("announcements")
      .insert(payload)
      .select("*")
      .single();

    if (error) return { data: null, error: new Error(error.message) };

    const announcement = data as Announcement;

    // Si la audiencia es específica, sincroniza tabla puente
    if (payload.audience_all === false) {
      const setRes = await setAnnouncementAudienceRoles(announcement.id, input.audience_roles ?? []);
      if (setRes.error) return { data: announcement, error: setRes.error };
    }

    return { data: announcement, error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}

// Actualizar anuncio + audiencia (solo full_access)
export async function updateAnnouncement(id: number, input: AnnouncementInput): Promise<{
  data: Announcement | null;
  error: Error | null;
}> {
  const patch: Partial<Announcement> = {};

  if (typeof input.message === "string") patch.message = input.message;
  if (input.level) patch.level = input.level;
  if ("url" in input) patch.url = input.url ?? null;
  if (typeof input.is_active === "boolean") patch.is_active = input.is_active;
  if (typeof input.dismissible === "boolean") patch.dismissible = input.dismissible;
  if ("starts_at" in input) patch.starts_at = input.starts_at ?? null;
  if ("ends_at" in input) patch.ends_at = input.ends_at ?? null;
  if (typeof input.audience_all === "boolean") patch.audience_all = input.audience_all;

  try {
    const { data, error } = await supabase
      .from("announcements")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return { data: null, error: new Error(error.message) };

    const updated = data as Announcement;

    // Sincronizar tabla puente según audience_all
    if (typeof input.audience_all === "boolean") {
      if (input.audience_all === true) {
        // Limpia cualquier rol previo si ahora es para todos
        const clear = await clearAnnouncementAudienceRoles(id);
        if (clear.error) return { data: updated, error: clear.error };
      } else {
        const setRes = await setAnnouncementAudienceRoles(id, input.audience_roles ?? []);
        if (setRes.error) return { data: updated, error: setRes.error };
      }
    } else if (input.audience_roles) {
      // audience_all no cambió, pero hay actualización de roles
      const setRes = await setAnnouncementAudienceRoles(id, input.audience_roles);
      if (setRes.error) return { data: updated, error: setRes.error };
    }

    return { data: updated, error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}

// Eliminar anuncio (solo full_access o delete)
export async function deleteAnnouncement(id: number): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) return { error: new Error(error.message) };
    return { error: null };
  } catch (e) {
    return { error: toError(e) };
  }
}

// Activar / Desactivar anuncio (RPC con SECURITY DEFINER)
export async function toggleAnnouncementActive(id: number, active: boolean): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.rpc("toggle_announcement_active", {
      p_id: id,
      p_active: active,
    });
    if (error) return { error: new Error(error.message) };
    return { error: null };
  } catch (e) {
    return { error: toError(e) };
  }
}

// Helpers: tabla puente announcement_audience_roles
// (solo full_access según RLS)
export async function setAnnouncementAudienceRoles(
  announcementId: number,
  roleIds: number[]
): Promise<{ error: Error | null }> {
  try {
    // Primero limpiamos
    const clearRes = await clearAnnouncementAudienceRoles(announcementId);
    if (clearRes.error) return clearRes;

    if (!roleIds || roleIds.length === 0) {
      return { error: null };
    }

    const rows: AnnouncementAudienceRole[] = roleIds.map((role_id) => ({
      announcement_id: announcementId,
      role_id,
    }));

    const { error } = await supabase.from("announcement_audience_roles").insert(rows);
    if (error) return { error: new Error(error.message) };
    return { error: null };
  } catch (e) {
    return { error: toError(e) };
  }
}

export async function clearAnnouncementAudienceRoles(announcementId: number): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from("announcement_audience_roles")
      .delete()
      .eq("announcement_id", announcementId);

    if (error) return { error: new Error(error.message) };
    return { error: null };
  } catch (e) {
    return { error: toError(e) };
  }
}

// Upsert conveniente (crea si no hay id, de lo contrario actualiza)
export async function upsertAnnouncement(
  input: AnnouncementInput & { id?: number }
): Promise<{ data: Announcement | null; error: Error | null }> {
  if (input.id) {
    return updateAnnouncement(input.id, input);
  }
  return createAnnouncement(input);
}

// Lectura de audiencia (solo gestión)
export async function getAnnouncementAudienceRoles(announcementId: number): Promise<{
  data: number[] | null; // role_ids
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from("announcement_audience_roles")
      .select("role_id")
      .eq("announcement_id", announcementId);

    if (error) return { data: null, error: new Error(error.message) };
    return { data: (data ?? []).map((r) => r.role_id), error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}