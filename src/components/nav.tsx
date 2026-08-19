"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";

interface NavProps {
  profile: { nome: string | null; email: string; role: UserRole };
  workspaces: { id: string; nome: string; slug: string; cor: string }[];
}

export default function Nav({ profile, workspaces }: NavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [aberto, setAberto] = useState(false);

  const isAdminOuTime = profile.role === "admin" || profile.role === "time";

  async function sair() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const linkClasses = (href: string) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition ${
      pathname === href || pathname.startsWith(href + "/")
        ? "bg-navy-800 text-white"
        : "text-navy-100/80 hover:bg-navy-800/60 hover:text-white"
    }`;

  return (
    <header className="bg-navy-900 px-4 py-3 shadow-md sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-white">
            Studio Ondare
          </Link>

          {isAdminOuTime && (
            <nav className="flex flex-wrap items-center gap-1">
              <Link href="/dashboard" className={linkClasses("/dashboard")}>
                Dashboard
              </Link>
              <Link href="/calendar" className={linkClasses("/calendar")}>
                Calendário Geral
              </Link>
              <Link href="/team" className={linkClasses("/team")}>
                Time
              </Link>
              <Link href="/workspaces" className={linkClasses("/workspaces")}>
                Clientes
              </Link>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setAberto((v) => !v)}
              className="flex items-center gap-2 rounded-md bg-navy-800 px-3 py-1.5 text-sm text-white hover:bg-navy-700"
            >
              Clientes
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            {aberto && (
              <div
                className="absolute right-0 z-20 mt-2 max-h-80 w-56 overflow-auto rounded-lg border border-border bg-white py-1 shadow-xl"
                onMouseLeave={() => setAberto(false)}
              >
                {workspaces.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted">Nenhum cliente ainda</p>
                )}
                {workspaces.map((w) => (
                  <Link
                    key={w.id}
                    href={`/w/${w.slug}/board`}
                    onClick={() => setAberto(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-navy-900 hover:bg-background"
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: w.cor }} />
                    {w.nome}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-white">{profile.nome ?? profile.email}</p>
            <p className="text-xs text-navy-100/60">{profile.role}</p>
          </div>

          <button
            onClick={sair}
            className="rounded-md px-3 py-1.5 text-sm text-navy-100/80 hover:bg-navy-800 hover:text-white"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
