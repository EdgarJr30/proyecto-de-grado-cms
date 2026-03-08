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
  updated_at?: string | null;
  password_reset_at?: string | null;
  password_reset_by?: string | null;
};

export type UserLinkOption = {
  id: string;
  email: string | null;
  name: string | null;
  last_name: string | null;
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

const USERS_SELECT_BASE =
  'id,email,name,last_name,location_id,rol_id,is_active,created_at';
const USERS_SELECT_WITH_PASSWORD_AUDIT = `${USERS_SELECT_BASE},updated_at,password_reset_at,password_reset_by`;

function isMissingRpcError(error: RpcErrorLike): boolean {
  if (!error) return false;
  // PGRST202 indica que PostgREST no encuentra la RPC en el schema cache.
  // Evitamos heurísticas por texto para no ocultar errores reales dentro de la función.
  return error.code === 'PGRST202';
}

function isMissingPasswordAuditColumnsError(error: RpcErrorLike): boolean {
  if (!error) return false;
  const msg = (error.message ?? '').toLowerCase();
  return (
    error.code === '42703' &&
    (msg.includes('password_reset_at') || msg.includes('password_reset_by'))
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

  let qWithAudit = supabase
    .from('users')
    .select(USERS_SELECT_WITH_PASSWORD_AUDIT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  if (search && search.trim().length >= 2) {
    const s = `%${search.trim()}%`;
    qWithAudit = qWithAudit.or(`email.ilike.${s},name.ilike.${s},last_name.ilike.${s}`);
  }

  if (location_id != null) {
    qWithAudit = qWithAudit.eq('location_id', location_id);
  }

  if (!includeInactive) {
    qWithAudit = qWithAudit.eq('is_active', true);
  }

  const withAuditRes = await qWithAudit;
  if (!withAuditRes.error) {
    return {
      data: (withAuditRes.data ?? []) as DbUser[],
      count: withAuditRes.count ?? 0,
    };
  }

  if (!isMissingPasswordAuditColumnsError(withAuditRes.error)) {
    throw withAuditRes.error;
  }

  // Compatibilidad para bases sin columnas de auditoría de reset.
  let qLegacy = supabase
    .from('users')
    .select(USERS_SELECT_BASE, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  if (search && search.trim().length >= 2) {
    const s = `%${search.trim()}%`;
    qLegacy = qLegacy.or(`email.ilike.${s},name.ilike.${s},last_name.ilike.${s}`);
  }

  if (location_id != null) {
    qLegacy = qLegacy.eq('location_id', location_id);
  }

  if (!includeInactive) {
    qLegacy = qLegacy.eq('is_active', true);
  }

  const { data, error, count } = await qLegacy;
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

export async function resetUserPassword(userId: string, newPassword: string) {
  const { error } = await supabase.rpc('admin_reset_user_password', {
    p_id: userId,
    p_new_password: newPassword,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      throw new Error(
        'La función admin_reset_user_password no está disponible en la base de datos.'
      );
    }
    throw error;
  }
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

export async function getUsersForAssigneeLinking(): Promise<UserLinkOption[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id,email,name,last_name,is_active')
    .order('name', { ascending: true })
    .order('last_name', { ascending: true })
    .order('email', { ascending: true });

  if (error) throw error;
  return (data ?? []) as UserLinkOption[];
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

  let qWithAudit = supabase
    .from('users')
    .select(USERS_SELECT_WITH_PASSWORD_AUDIT, { count: 'exact' })
    .eq('rol_id', roleId);

  if (!includeInactive) qWithAudit = qWithAudit.eq('is_active', true);

  if (search && search.trim().length >= 2) {
    const s = `%${search.trim()}%`;
    qWithAudit = qWithAudit.or(
      [`email.ilike.${s}`, `name.ilike.${s}`, `last_name.ilike.${s}`].join(',')
    );
  }

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const withAuditRes = await qWithAudit
    .order('created_at', { ascending: false })
    .range(from, to);

  if (!withAuditRes.error) {
    return {
      data: (withAuditRes.data ?? []) as DbUser[],
      count: withAuditRes.count ?? 0,
    };
  }

  if (!isMissingPasswordAuditColumnsError(withAuditRes.error)) {
    throw withAuditRes.error;
  }

  let qLegacy = supabase
    .from('users')
    .select(USERS_SELECT_BASE, { count: 'exact' })
    .eq('rol_id', roleId);

  if (!includeInactive) qLegacy = qLegacy.eq('is_active', true);

  if (search && search.trim().length >= 2) {
    const s = `%${search.trim()}%`;
    qLegacy = qLegacy.or(
      [`email.ilike.${s}`, `name.ilike.${s}`, `last_name.ilike.${s}`].join(',')
    );
  }

  const { data, error, count } = await qLegacy
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

  let qWithAudit = supabase
    .from('users')
    .select(USERS_SELECT_WITH_PASSWORD_AUDIT, { count: 'exact' })
    .is('rol_id', null);

  if (!includeInactive) qWithAudit = qWithAudit.eq('is_active', true);

  if (search && search.trim().length >= 2) {
    const s = `%${search.trim()}%`;
    qWithAudit = qWithAudit.or(
      [`email.ilike.${s}`, `name.ilike.${s}`, `last_name.ilike.${s}`].join(',')
    );
  }

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const withAuditRes = await qWithAudit
    .order('created_at', { ascending: false })
    .range(from, to);

  if (!withAuditRes.error) {
    return {
      data: (withAuditRes.data ?? []) as DbUser[],
      count: withAuditRes.count ?? 0,
    };
  }

  if (!isMissingPasswordAuditColumnsError(withAuditRes.error)) {
    throw withAuditRes.error;
  }

  let qLegacy = supabase
    .from('users')
    .select(USERS_SELECT_BASE, { count: 'exact' })
    .is('rol_id', null);

  if (!includeInactive) qLegacy = qLegacy.eq('is_active', true);

  if (search && search.trim().length >= 2) {
    const s = `%${search.trim()}%`;
    qLegacy = qLegacy.or(
      [`email.ilike.${s}`, `name.ilike.${s}`, `last_name.ilike.${s}`].join(',')
    );
  }

  const { data, error, count } = await qLegacy
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { data: (data ?? []) as DbUser[], count: count ?? 0 };
}

export async function getUserIdentityById(userId: string): Promise<{
  id: string;
  name: string | null;
  last_name: string | null;
  email: string | null;
} | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id,name,last_name,email')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as {
    id: string;
    name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

export async function getUserPasswordResetAuditById(userId: string): Promise<{
  updated_at: string | null;
  password_reset_at: string | null;
  password_reset_by: string | null;
} | null> {
  const { data, error } = await supabase
    .from('users')
    .select('updated_at,password_reset_at,password_reset_by')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    if (isMissingPasswordAuditColumnsError(error)) return null;
    throw error;
  }
  return (data ?? null) as {
    updated_at: string | null;
    password_reset_at: string | null;
    password_reset_by: string | null;
  } | null;
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
