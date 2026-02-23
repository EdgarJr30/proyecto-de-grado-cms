import { supabase } from '../lib/supabaseClient';
import { normalizeLocationId } from '../utils/locationId';
import { invalidateData } from '../lib/dataInvalidation';

export type RoleName = string;

export type UserProfile = {
  id: string;
  name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  location_id: number | null;
  is_active?: boolean;
};

type AuthMeta = {
  name?: unknown;
  last_name?: unknown;
  phone?: unknown;
  location_id?: unknown;
};

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveLocationId(
  primary: unknown,
  fallback: unknown
): number | null {
  const fromPrimary = normalizeLocationId(
    primary as number | string | bigint | null | undefined
  );
  if (fromPrimary != null) return fromPrimary;
  return normalizeLocationId(
    fallback as number | string | bigint | null | undefined
  );
}

export async function getCurrentUserRole(): Promise<RoleName | null> {
  const {
    data: { session },
    error: sErr,
  } = await supabase.auth.getSession();
  if (sErr) {
    console.error('getSession error:', sErr.message);
    return null;
  }

  const userId = session?.user?.id;
  if (!userId) return null;

  type EmbedData = { rol_id: string | null; roles?: { name: string } | null };
  const { data: embedData, error: embedErr } = await supabase
    .from('users')
    .select('rol_id, roles:roles!users_rol_id_fkey(name)')
    .eq('id', userId)
    .maybeSingle<EmbedData>();

  if (embedErr) {
    console.warn('embed error:', embedErr.message);
  }

  let roleName = embedData?.roles?.name as RoleName | undefined;

  if (!roleName && embedData?.rol_id != null) {
    const { data: roleRow, error: roleErr } = await supabase
      .from('roles')
      .select('name')
      .eq('id', embedData.rol_id)
      .maybeSingle();

    if (roleErr) {
      console.warn('roles lookup error:', roleErr.message);
      return null;
    }
    roleName = roleRow?.name as RoleName | undefined;
  }

  return roleName ?? null;
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('Error fetching auth user:', authError.message);
    return null;
  }

  const userId = authUser?.id;
  if (!userId) return null;

  const authMeta = (authUser?.user_metadata ?? {}) as AuthMeta;

  const { data, error } = await supabase
    .from('users')
    .select('id, name, last_name, email, phone, location_id, is_active')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user profile:', error.message);
    return {
      id: userId,
      name: asTrimmedString(authMeta.name) ?? '',
      last_name: asTrimmedString(authMeta.last_name) ?? '',
      email: authUser?.email ?? null,
      phone: asTrimmedString(authMeta.phone),
      location_id: resolveLocationId(null, authMeta.location_id),
      is_active: true,
    };
  }

  if (!data) {
    return {
      id: userId,
      name: asTrimmedString(authMeta.name) ?? '',
      last_name: asTrimmedString(authMeta.last_name) ?? '',
      email: authUser?.email ?? null,
      phone: asTrimmedString(authMeta.phone),
      location_id: resolveLocationId(null, authMeta.location_id),
      is_active: true,
    };
  }

  const dbRow = data as Partial<UserProfile> & {
    location_id?: number | string | bigint | null;
  };

  return {
    id: dbRow.id ?? userId,
    name: (dbRow.name ?? asTrimmedString(authMeta.name) ?? '').trim(),
    last_name: (dbRow.last_name ?? asTrimmedString(authMeta.last_name) ?? '').trim(),
    email: dbRow.email ?? authUser?.email ?? null,
    phone: dbRow.phone ?? asTrimmedString(authMeta.phone),
    location_id: resolveLocationId(dbRow.location_id, authMeta.location_id),
    is_active: dbRow.is_active,
  };
}

export async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) {
    console.error('getUser error:', error.message);
    return null;
  }
  return user?.id ?? null;
}

export type UserProfilePatch = Partial<
  Pick<UserProfile, 'name' | 'last_name' | 'phone' | 'location_id'>
>;

export async function updateCurrentUserProfile(
  patch: UserProfilePatch
): Promise<UserProfile | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const authDataPatch: Record<string, unknown> = {};
  if (typeof patch.name === 'string') {
    authDataPatch.name = patch.name.trim();
  }
  if (typeof patch.last_name === 'string') {
    authDataPatch.last_name = patch.last_name.trim();
  }
  if (typeof patch.phone === 'string' || patch.phone === null) {
    authDataPatch.phone = patch.phone;
  }
  if (typeof patch.location_id === 'number' || patch.location_id === null) {
    authDataPatch.location_id = normalizeLocationId(patch.location_id);
  }

  if (Object.keys(authDataPatch).length > 0) {
    const { error: authUpdateError } = await supabase.auth.updateUser({
      data: authDataPatch,
    });
    if (authUpdateError) {
      console.warn('Error syncing auth user metadata:', authUpdateError.message);
    }
  }

  const { data, error } = await supabase
    .from('users')
    .update(patch)
    .eq('id', userId)
    .select('id, name, last_name, email, phone, location_id')
    .single();

  if (error) {
    console.error('Error updating user profile:', error.message);
    return null;
  }
  invalidateData('users');
  return data as UserProfile;
}

export async function changeCurrentUserPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const current = currentPassword.trim();
  const next = newPassword.trim();

  if (!current) {
    throw new Error('Debes indicar tu contraseña actual.');
  }
  if (!next) {
    throw new Error('Debes indicar la nueva contraseña.');
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr) {
    throw new Error(userErr.message);
  }
  if (!user?.email) {
    throw new Error('No fue posible validar el usuario autenticado.');
  }

  const { error: verifyErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  });

  if (verifyErr) {
    const msg = verifyErr.message?.toLowerCase() ?? '';
    if (msg.includes('invalid login credentials')) {
      throw new Error('La contraseña actual no es correcta.');
    }
    throw new Error(verifyErr.message);
  }

  const { error: updateErr } = await supabase.auth.updateUser({
    password: next,
  });

  if (updateErr) {
    throw new Error(updateErr.message);
  }
}
