import { supabase } from "../lib/supabaseClient";
import { recordAuthEvent } from "../services/activityLogService";

export async function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  // Registra el cierre de sesión antes de invalidar la sesión (best-effort).
  await recordAuthEvent("logout");
  return supabase.auth.signOut();
}

export async function getSession() {
  return supabase.auth.getSession();
}

export async function isAuthenticated() {
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}
