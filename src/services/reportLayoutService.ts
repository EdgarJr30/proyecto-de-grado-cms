import { getCurrentUserId } from './userService';

const LOCAL_STORAGE_PREFIX = 'reports:kpi-layout:v1';
const ENABLE_REMOTE_LAYOUT_SYNC = import.meta.env.VITE_ENABLE_REMOTE_REPORT_LAYOUT === 'true';

type ReportLayoutRow = {
  tab_id: string;
  widget_order: unknown;
};

function sanitizeWidgetOrder(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const id = entry.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }

  return result;
}

function getStorageKey(userId: string) {
  return `${LOCAL_STORAGE_PREFIX}:${userId}`;
}

function readFromLocalStorage(userId: string): Record<string, string[]> {
  if (typeof window === 'undefined') return {};

  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Record<string, string[]> = {};

    for (const [tabId, order] of Object.entries(parsed)) {
      if (!tabId.trim()) continue;
      result[tabId] = sanitizeWidgetOrder(order);
    }

    return result;
  } catch {
    return {};
  }
}

function writeToLocalStorage(userId: string, nextLayouts: Record<string, string[]>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getStorageKey(userId), JSON.stringify(nextLayouts));
}

export async function getReportLayoutPreferences(): Promise<Record<string, string[]>> {
  const userId = await getCurrentUserId();
  if (!userId) return {};
  const localLayouts = readFromLocalStorage(userId);

  if (!ENABLE_REMOTE_LAYOUT_SYNC) {
    return localLayouts;
  }

  const { supabase } = await import('../lib/supabaseClient');
  const { data, error } = await supabase
    .from('report_layout_preferences')
    .select('tab_id, widget_order')
    .eq('user_id', userId);

  if (error) {
    console.warn(`No se pudo cargar layout desde Supabase, usando localStorage: ${error.message}`);
    return localLayouts;
  }

  const rows = (data ?? []) as ReportLayoutRow[];
  const result: Record<string, string[]> = { ...localLayouts };

  for (const row of rows) {
    if (typeof row.tab_id !== 'string' || !row.tab_id.trim()) continue;
    result[row.tab_id] = sanitizeWidgetOrder(row.widget_order);
  }

  return result;
}

export async function saveReportLayoutPreference(tabId: string, widgetOrder: string[]): Promise<void> {
  const cleanTabId = tabId.trim();
  if (!cleanTabId) return;

  const userId = await getCurrentUserId();
  if (!userId) {
    return;
  }

  const nextLocalLayouts = {
    ...readFromLocalStorage(userId),
    [cleanTabId]: sanitizeWidgetOrder(widgetOrder),
  };
  writeToLocalStorage(userId, nextLocalLayouts);

  if (!ENABLE_REMOTE_LAYOUT_SYNC) {
    return;
  }

  const { supabase } = await import('../lib/supabaseClient');
  const payload = {
    user_id: userId,
    tab_id: cleanTabId,
    widget_order: nextLocalLayouts[cleanTabId],
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('report_layout_preferences')
    .upsert(payload, { onConflict: 'user_id,tab_id' });

  if (error) {
    console.warn(`No se pudo guardar layout en Supabase, quedó guardado local: ${error.message}`);
  }
}
