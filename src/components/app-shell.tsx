"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Goal, Settings, Trophy } from "lucide-react";

import { cn } from "@/lib/cn";

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/matches/new", label: "Novo jogo", icon: Trophy },
  { href: "/settings", label: "Definições", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-pitch-950/82 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-cyan-200 shadow-glow">
              <Goal size={22} strokeWidth={2.2} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold uppercase tracking-[0.24em] text-cyan-100">
                Análise Adversário
              </span>
              <span className="block truncate text-xs text-slate-400">Tática, vídeo local e momentos</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm text-slate-300 transition hover:bg-white/[0.08] hover:text-white",
                    active && "bg-cyan-300/12 text-cyan-100 ring-1 ring-cyan-300/20",
                  )}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1800px] px-4 py-5 sm:px-6">{children}</main>
    </div>
  );
}
