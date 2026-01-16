import { supabase } from "../lib/supabaseClient";

// Sube una imagen y retorna el path usado
export async function uploadImageToBucket(file: File, ticketId: number, idx: number) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${ticketId}_${Date.now()}_${idx}.${fileExt}`;
  const filePath = `${ticketId}/${fileName}`;

  const { error } = await supabase
    .storage
    .from("attachments")
    .upload(filePath, file, { 
      upsert: true, 
      contentType: file.type ?? "image/webp" 
    });

  if (error) {
    console.error("Upload error:", error.message);
    throw error;
  }
  return filePath;
    //   El path será algo como: 123/123_1689532320_0.webp, es decir, una carpeta por ticket con archivos únicos.
}

export function getPublicImageUrl(path: string) {
  return supabase.storage.from("attachments").getPublicUrl(path).data.publicUrl;
}

export function getTicketImagePaths(imageField: string): string[] {
  try {
    const arr = JSON.parse(imageField);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
