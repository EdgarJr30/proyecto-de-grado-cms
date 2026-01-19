// services/userAdminService.ts
import { supabase } from '../lib/supabaseClient';

export type DbUser = {
  id: string;
  email: string;
  name: string | null;
  last_name: string | null;
  location_id: number | null;
  rol_id: number | null;
  created_at: string;
  is_active: boolean;
};

type Paginated = {
  data: DbUser[];
  count: number;
};

/* =========================
   Lista general
   ========================= */
export async function getUsersPaginated(opts: {
  page: number;
  pageSize: number;
  search?: string;
  location_id: number | null;
  includeInactive?: boolean;
}): Promise<Paginated> {
  const { page, pageSize, search, location_id, includeInactive } = opts;

  let q = supabase
    .from('users')
    .select('id,email,name,last_name,location_id,rol_id,is_active,created_at', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  if (search && search.trim().length >= 2) {
    const s = `%${search.trim()}%`;
    q = q.or(`email.ilike.${s},name.ilike.${s},last_name.ilike.${s}`);
  }

  if (location_id != null) {
    q = q.eq('location_id', location_id);
  }

  if (!includeInactive) {
    q = q.eq('is_active', true);
  }

  const { data, error, count } = await q;
  if (error) throw error;

  return { data: (data ?? []) as DbUser[], count: count ?? 0 };
}

export async function updateUser(userId: string, patch: Partial<DbUser>) {
  const { error } = await supabase
    .from('users')
    .update({
      name: patch.name ?? null,
      last_name: patch.last_name ?? null,
      email: patch.email ?? null,
      location_id: patch.location_id ?? null,
      rol_id:
        typeof patch.rol_id === 'number'
          ? patch.rol_id
          : patch.rol_id === null
            ? null
            : undefined,
    })
    .eq('id', userId);

  if (error) throw error;
}

export async function setUserActive(userId: string, active: boolean) {
  const { error } = await supabase
    .from('users')
    .update({ is_active: active })
    .eq('id', userId);
  if (error) throw error;
}

export async function bulkSetUserActive(ids: string[], active: boolean) {
  if (!ids.length) return;
  const { error } = await supabase
    .from('users')
    .update({ is_active: active })
    .in('id', ids);
  if (error) throw error;
}

export async function deleteUser(userId: string) {
  const { error } = await supabase.from('users').delete().eq('id', userId);
  if (error) throw error;
}

/* =========================================
   NUEVO: Paginación por rol y asignaciones
   ========================================= */

export async function getUsersByRolePaginated(opts: {
  roleId: number;
  page: number;
  pageSize: number;
  search?: string;
  includeInactive?: boolean;
}): Promise<Paginated> {
  const { roleId, page, pageSize, search, includeInactive } = opts;

  let q = supabase
    .from('users')
    .select('id,email,name,last_name,location_id,rol_id,is_active,created_at', {
      count: 'exact',
    })
    .eq('rol_id', roleId);

  if (!includeInactive) q = q.eq('is_active', true);

  if (search && search.trim().length >= 2) {
    const s = `%${search.trim()}%`;
    q = q.or(
      [`email.ilike.${s}`, `name.ilike.${s}`, `last_name.ilike.${s}`].join(',')
    );
  }

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await q
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { data: (data ?? []) as DbUser[], count: count ?? 0 };
}

export async function getUsersWithoutRolePaginated(opts: {
  page: number;
  pageSize: number;
  search?: string;
  includeInactive?: boolean;
}): Promise<Paginated> {
  const { page, pageSize, search, includeInactive } = opts;

  let q = supabase
    .from('users')
    .select('id,email,name,last_name,location_id,rol_id,is_active,created_at', {
      count: 'exact',
    })
    .is('rol_id', null);

  if (!includeInactive) q = q.eq('is_active', true);

  if (search && search.trim().length >= 2) {
    const s = `%${search.trim()}%`;
    q = q.or(
      [`email.ilike.${s}`, `name.ilike.${s}`, `last_name.ilike.${s}`].join(',')
    );
  }

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await q
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { data: (data ?? []) as DbUser[], count: count ?? 0 };
}

export async function bulkSetUsersRole(
  userIds: string[],
  roleId: number
): Promise<void> {
  if (!userIds.length) return;
  const { error } = await supabase
    .from('users')
    .update({ rol_id: roleId })
    .in('id', userIds);
  if (error) throw error;
}

export async function bulkClearUsersRole(userIds: string[]): Promise<void> {
  if (!userIds.length) return;
  const { error } = await supabase
    .from('users')
    .update({ rol_id: null })
    .in('id', userIds);
  if (error) throw error;
}
