function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  const letras = partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : partes[0]?.slice(0, 2);
  return (letras ?? "?").toUpperCase();
}

export default function Avatar({
  nome,
  url,
  tamanho = 28,
}: {
  nome: string;
  url?: string | null;
  tamanho?: number;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- fotos vêm do Supabase Storage, domínio dinâmico
      <img
        src={url}
        alt={nome}
        width={tamanho}
        height={tamanho}
        className="shrink-0 rounded-full object-cover"
        style={{ width: tamanho, height: tamanho }}
      />
    );
  }

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-navy-600 font-medium text-white"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.4 }}
    >
      {iniciais(nome)}
    </span>
  );
}
