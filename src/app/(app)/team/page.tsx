import Equipe from "@/components/equipe";

export default function TeamPage() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Time</h1>
      <Equipe workspaceId={null} legenda='Membros do Studio Ondare, disponíveis no seletor de "Responsável" em qualquer quadro.' />
    </div>
  );
}
