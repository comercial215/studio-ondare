/** Redimensiona/comprime uma imagem no navegador antes do upload. */
export async function comprimirImagem(arquivo: File, ladoMaximo = 800, qualidade = 0.85): Promise<File> {
  if (!arquivo.type.startsWith("image/") || arquivo.type === "image/svg+xml") return arquivo;

  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) return arquivo;
  ctx.drawImage(bitmap, 0, 0, largura, altura);

  const manterTransparencia = arquivo.type === "image/png";
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, manterTransparencia ? "image/png" : "image/jpeg", qualidade)
  );
  if (!blob) return arquivo;

  const extensao = manterTransparencia ? "png" : "jpg";
  const nome = arquivo.name.replace(/\.[^.]+$/, "") + "." + extensao;
  return new File([blob], nome, { type: blob.type });
}

/** Extrai a cor dominante (ignorando transparência/branco/preto de fundo) de uma imagem. */
export async function extrairCorDominante(arquivo: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(arquivo);
    const tamanho = 40;
    const canvas = document.createElement("canvas");
    canvas.width = tamanho;
    canvas.height = tamanho;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, tamanho, tamanho);

    const { data } = ctx.getImageData(0, 0, tamanho, tamanho);
    const baldes = new Map<string, { r: number; g: number; b: number; contagem: number }>();

    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
      if (a < 200) continue; // pixel transparente
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max > 240 && min > 225) continue; // quase branco
      if (max < 25) continue; // quase preto
      if (max - min < 12 && (max > 200 || max < 55)) continue; // cinza claro/escuro sem saturação

      const chave = `${Math.round(r / 24)}-${Math.round(g / 24)}-${Math.round(b / 24)}`;
      const atual = baldes.get(chave) ?? { r: 0, g: 0, b: 0, contagem: 0 };
      atual.r += r;
      atual.g += g;
      atual.b += b;
      atual.contagem += 1;
      baldes.set(chave, atual);
    }

    if (baldes.size === 0) return null;

    const dominante = Array.from(baldes.values()).sort((a, b) => b.contagem - a.contagem)[0];
    const r = Math.round(dominante.r / dominante.contagem);
    const g = Math.round(dominante.g / dominante.contagem);
    const b = Math.round(dominante.b / dominante.contagem);

    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}
