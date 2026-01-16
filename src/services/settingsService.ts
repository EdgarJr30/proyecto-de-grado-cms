import { supabase } from '../lib/supabaseClient';

export async function getMaxSecondaryAssignees(): Promise<number> {
  const { data, error } = await supabase.rpc('get_max_secondary_assignees');
  if (error) throw new Error(error.message);
  return (data as number) ?? 2;
}

export async function setMaxSecondaryAssignees(n: number): Promise<void> {
  const { error } = await supabase.rpc('set_max_secondary_assignees', { p_value: n });
  if (error) throw new Error(error.message);
}
