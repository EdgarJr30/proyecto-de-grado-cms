// services/userAdminService.ts
import { supabase } from '../lib/supabaseClient';
import { invalidateData } from '../lib/dataInvalidation';

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

type RpcErrorLike = {
  code?: string;
  message?: string;
} | null;

function isMissingRpcError(error: RpcErrorLike): boolean {
  if (!error) return false;
  const msg = (error.message ?? '').toLowerCase();
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    msg.includes('could not find the function') ||
    msg.includes('does not exist')
  );
}

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
  const roleProvided = typeof patch.rol_id !== 'undefined';

  const { error: rpcError } = await supabase.rpc('admin_update_user_profile', {
    p_id: userId,
    p_email: patch.email ?? null,
    p_name: patch.name ?? null,
    p_last_name: patch.last_name ?? null,
    p_location: patch.location_id ?? null,
    p_rol_id:
      typeof patch.rol_id === 'number'
        ? patch.rol_id
        : patch.rol_id === null
          ? null
          : null,
    p_update_role: roleProvided,
  });

  if (rpcError && !isMissingRpcError(rpcError)) {
    throw rpcError;
  }

  // Compatibilidad para entornos donde la nueva RPC aún no fue aplicada.
  if (rpcError && isMissingRpcError(rpcError)) {
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

    if (roleProvided) {
      const { error: clearRoleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      if (clearRoleError) throw clearRoleError;

      if (typeof patch.rol_id === 'number') {
        const { error: assignRoleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role_id: patch.rol_id,
          });
        if (assignRoleError) throw assignRoleError;
      }
    }
  }

  if (typeof patch.rol_id !== 'undefined') {
    invalidateData('permissions');
  }
  invalidateData('users');
}

export async function setUserActive(userId: string, active: boolean) {
  const { error } = await supabase
    .from('users')
    .update({ is_active: active })
    .eq('id', userId);
  if (error) throw error;
  invalidateData('users');
}

export async function bulkSetUserActive(ids: string[], active: boolean) {
  if (!ids.length) return;
  const { error } = await supabase
    .from('users')
    .update({ is_active: active })
    .in('id', ids);
  if (error) throw error;
  invalidateData('users');
}

export async function deleteUser(userId: string) {
  const { error } = await supabase.from('users').delete().eq('id', userId);
  if (error) throw error;
  invalidateData('users');
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
  invalidateData('permissions');
}

export async function bulkClearUsersRole(userIds: string[]): Promise<void> {
  if (!userIds.length) return;
  const { error } = await supabase
    .from('users')
    .update({ rol_id: null })
    .in('id', userIds);
  if (error) throw error;
  invalidateData('permissions');
}
