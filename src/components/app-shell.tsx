"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, BarChart3, FileBarChart, Goal, LockKeyhole, LogOut, Settings, Trophy, Wrench } from "lucide-react";

import { ManagementAccessDialog } from "@/components/management-access-dialog";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { accessAreaForPath, type AccessArea } from "@/lib/access-areas";
import { apiFetch } from "@/lib/http";
import { cn } from "@/lib/cn";
import { APP_NAME } from "@/lib/taxonomy";

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3, area: "dashboard" as const },
  { href: "/matches/new", label: "New match", icon: Trophy, area: "newMatch" as const },
  { href: "/reports", label: "Reports", icon: FileBarChart, area: "reports" as const },
  { href: "/maintenance", label: "Maintenance", icon: Wrench, area: "maintenance" as const },
  { href: "/settings", label: "Settings", icon: Settings, area: "settings" as const },
];
type Account = { accessControl: { globalUnlocked: boolean; unlockedAreas: AccessArea[] } };
function unlocked(account: Account, area: AccessArea | null) { return !area || account.accessControl.globalUnlocked || account.accessControl.unlockedAreas.includes(area); }

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [pendingArea, setPendingArea] = useState<AccessArea | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const currentArea = accessAreaForPath(pathname);
  const isPublic = pathname === "/login" || pathname === "/register" || pathname === "/change-password";
  useEffect(() => {
    if (isPublic) return;
    apiFetch<Account>("/api/account").then((next) => { setAccount(next); if (!unlocked(next, currentArea)) setPendingArea(currentArea); }).catch(() => undefined);
  }, [currentArea, isPublic]);
  const pageAlreadyHasBackButton = pathname === "/matches/new" || /^\/matches\/[^/]+\/edit$/.test(pathname) || pathname.startsWith("/analysis/");
  if (isPublic) return <main className="min-h-screen">{children}</main>;

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-pitch-950/82 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-cyan-200 shadow-glow">
              <Goal size={22} strokeWidth={2.2} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-cyan-100">
                {APP_NAME}
              </span>
              <span className="block truncate text-xs text-slate-400">Tactics, local video and moments</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <PwaInstallButton />
            <nav className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(event) => { if (account && !unlocked(account, item.area)) { event.preventDefault(); setPendingArea(item.area); setPendingHref(item.href); } }}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm text-slate-300 transition hover:bg-white/[0.08] hover:text-white",
                      active && "bg-cyan-300/12 text-cyan-100 ring-1 ring-cyan-300/20",
                    )}
                  >
                    <Icon size={16} />
                    <span className="hidden sm:inline">{item.label}</span>
                    {account && !unlocked(account, item.area) ? <LockKeyhole size={10} className="text-amber-300"/> : null}
                  </Link>
                );
              })}
            </nav>
            <button onClick={() => void logout()} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-white/[0.08] hover:text-white" aria-label="Sign out"><LogOut size={16} /></button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1800px] px-4 py-5 sm:px-6">
        {pathname !== "/" && !pageAlreadyHasBackButton ? (
          <button
            type="button"
            className="mb-3 inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
            onClick={() => window.history.length > 1 ? router.back() : router.push("/")}
          >
            <ArrowLeft size={14} />
            Back
          </button>
        ) : null}
        {children}
      </main>
      {account && pendingArea ? <ManagementAccessDialog area={pendingArea} canDismiss={unlocked(account, currentArea)} onDismiss={() => { setPendingArea(null); setPendingHref(null); }} onUnlocked={(accessControl) => { setAccount({ ...account, accessControl }); const target = pendingHref; setPendingArea(null); setPendingHref(null); if (target && target !== pathname) window.location.href = target; else window.location.reload(); }}/>: null}
    </div>
  );
}
