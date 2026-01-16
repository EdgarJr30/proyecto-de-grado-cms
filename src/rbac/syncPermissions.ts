import { PERMISSIONS } from './permissionRegistry';
import { supabase } from '../lib/supabaseClient';

export async function syncPermissions() {
  const payload = PERMISSIONS.map(p => ({
    resource: p.resource,
    action: p.action,
    label: p.label,
    description: p.description ?? null,
    is_active: p.is_active ?? true,
  }));

  const { error } = await supabase.rpc('sync_permissions', { perms: payload });
  if (error) throw new Error(error.message);
}
