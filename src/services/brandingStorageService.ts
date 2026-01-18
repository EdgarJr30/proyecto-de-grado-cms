import { supabase } from '../lib/supabaseClient';

type BrandingKind = 'logo' | 'login';

function makeBrandingPath(
  societyId: number,
  kind: BrandingKind,
  fileExt = 'webp'
) {
  // cache-busting: cambia el nombre cada vez
  return `societies/${societyId}/${kind}_${Date.now()}.${fileExt}`;
}

export async function uploadSocietyBrandingImage(
  file: File,
  societyId: number,
  kind: BrandingKind
): Promise<string> {
  const ext = (file.name.split('.').pop() ?? 'webp').toLowerCase();
  const fileExt = ext === 'jpeg' ? 'jpg' : ext;

  const path = makeBrandingPath(societyId, kind, fileExt);

  const { error } = await supabase.storage.from('branding').upload(path, file, {
    upsert: true,
    contentType: file.type ?? 'image/webp',
    cacheControl: '3600',
  });

  if (error) throw new Error(error.message);

  return path; // Guardamos el PATH en la DB
}

export function getBrandingPublicUrl(path: string) {
  return supabase.storage.from('branding').getPublicUrl(path).data.publicUrl;
}
