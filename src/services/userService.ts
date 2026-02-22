import { supabase } from '../lib/supabaseClient';

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
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('users')
    .select('id, name, last_name, email, phone, location_id, is_active')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user profile:', error.message);
    return null;
  }
  return (data ?? null) as UserProfile | null;
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
