import { SupabaseClient } from "@supabase/supabase-js";
import { comprimirImagem } from "./image";

export async function uploadImagem(
  supabase: SupabaseClient,
  bucket: "avatars" | "logos",
  arquivo: File
): Promise<string> {
  const arquivoFinal = await comprimirImagem(arquivo);
  const extensao = arquivoFinal.name.split(".").pop();
  const caminho = `${crypto.randomUUID()}.${extensao}`;

  const { error } = await supabase.storage.from(bucket).upload(caminho, arquivoFinal, {
    cacheControl: "3600",
    upsert: false,
    contentType: arquivoFinal.type,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(caminho);
  return data.publicUrl;
}
