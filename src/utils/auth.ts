import { supabase } from "../lib/supabaseClient";

export async function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  return supabase.auth.getSession();
}

export async function isAuthenticated() {
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}
