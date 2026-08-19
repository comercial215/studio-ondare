import { SupabaseClient } from "@supabase/supabase-js";

export async function uploadImagem(
  supabase: SupabaseClient,
  bucket: "avatars" | "logos",
  arquivo: File
): Promise<string> {
  const extensao = arquivo.name.split(".").pop();
  const caminho = `${crypto.randomUUID()}.${extensao}`;

  const { error } = await supabase.storage.from(bucket).upload(caminho, arquivo, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(caminho);
  return data.publicUrl;
}
