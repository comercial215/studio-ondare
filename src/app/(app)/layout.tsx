import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, nome, role, workspace_id, workspaces:workspace_id(id, nome, slug, cor)")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  let workspaces: { id: string; nome: string; slug: string; cor: string }[] = [];

  if (profile.role === "admin" || profile.role === "time") {
    const { data } = await supabase
      .from("workspaces")
      .select("id, nome, slug, cor")
      .order("nome");
    workspaces = data ?? [];
  } else if (profile.workspaces) {
    workspaces = [profile.workspaces as unknown as { id: string; nome: string; slug: string; cor: string }];
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Nav
        profile={{ nome: profile.nome, email: profile.email, role: profile.role }}
        workspaces={workspaces}
      />
      <main className="flex-1 bg-background">{children}</main>
    </div>
  );
}
