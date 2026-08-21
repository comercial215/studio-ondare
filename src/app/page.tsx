import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomeRedirect() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role === "cliente") {
    const { data: acessos } = await supabase
      .from("workspace_acessos")
      .select("workspaces:workspace_id(slug)")
      .order("criado_em")
      .limit(1);

    const workspace = acessos?.[0]?.workspaces as unknown as { slug: string } | null;
    if (workspace?.slug) redirect(`/w/${workspace.slug}/board`);
    redirect("/login");
  }

  redirect("/dashboard");
}
