"use client";

import { useEffect, useState } from "react";
import { Check, Cloud, Copy, Link2, Loader2 } from "lucide-react";

import { Button, FieldLabel, Panel, TextInput } from "@/components/ui";
import { apiFetch } from "@/lib/http";

type LinkStatus = { linked: boolean; linkedApps: string[] };
type LinkToken = { token: string; expiresAt: string };

const appLabels: Record<string, string> = {
  "player-analysis": "Player Analysis",
  "team-analysis": "Team Analysis",
  "opponent-analysis": "Opponent Analysis",
};

export function MediaLibraryLinkPanel() {
  const [status, setStatus] = useState<LinkStatus | null>(null);
  const [token, setToken] = useState("");
  const [generated, setGenerated] = useState<LinkToken | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<LinkStatus>("/api/media-library/link").then(setStatus).catch((error: Error) => setMessage(error.message));
  }, []);

  async function createCode() {
    setWorking(true);
    setMessage(null);
    try {
      setGenerated(await apiFetch<LinkToken>("/api/media-library/link", { method: "POST", body: JSON.stringify({ action: "create" }) }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create a linking code.");
    } finally {
      setWorking(false);
    }
  }

  async function linkAccount() {
    if (!token.trim()) return;
    setWorking(true);
    setMessage(null);
    try {
      const next = await apiFetch<LinkStatus>("/api/media-library/link", { method: "POST", body: JSON.stringify({ action: "claim", token }) });
      setStatus(next);
      setToken("");
      setGenerated(null);
      setMessage("The shared cloud library is now linked permanently.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not link the cloud library.");
    } finally {
      setWorking(false);
    }
  }

  async function copyCode() {
    if (!generated) return;
    await navigator.clipboard.writeText(generated.token);
    setMessage("Linking code copied.");
  }

  return (
    <Panel className="overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 p-4">
        <div>
          <div className="flex items-center gap-2"><Cloud size={17} className="text-cyan-300" /><FieldLabel>Shared cloud library</FieldLabel></div>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">Connect the Player, Team and Opponent applications to one private video library. The files are shared without uploading or duplicating them again.</p>
        </div>
        {status?.linked ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-200"><Check size={11} />Linked</span> : null}
      </div>
      <div className="space-y-4 p-4">
        {status?.linkedApps.length ? <p className="text-xs text-slate-400">Connected applications: <strong className="text-slate-200">{status.linkedApps.map((app) => appLabels[app] || app).join(", ")}</strong></p> : null}
        <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/[.04] p-3">
          <p className="text-sm font-semibold text-cyan-50">How to connect two applications</p>
          <ol className="mt-2 grid gap-2 text-xs leading-5 text-slate-400 sm:grid-cols-3"><li><strong className="text-white">1.</strong> In the application that already has the videos, create and copy a code.</li><li><strong className="text-white">2.</strong> Open the other application and paste the code under “Link this application”.</li><li><strong className="text-white">3.</strong> Confirm the link. Both applications will then use the same library permanently.</li></ol>
          <p className="mt-2 text-[11px] text-amber-100/80">The code is private, expires after 30 minutes and works once. The permanent link does not share account passwords.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/[.025] p-3">
            <p className="text-sm font-semibold text-white">Link this application</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Use this side in the application that still needs access to the shared videos.</p>
            <div className="mt-3 flex gap-2"><TextInput value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste linking code" autoComplete="off" /><Button variant="primary" disabled={working || !token.trim()} onClick={() => void linkAccount()}>{working ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}Link</Button></div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[.025] p-3">
            <p className="text-sm font-semibold text-white">Connect another application</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Use this side in the application whose video library should be kept as the destination.</p>
            {generated ? <div className="mt-3"><div className="flex gap-2"><TextInput readOnly value={generated.token} className="font-mono text-xs" /><Button onClick={() => void copyCode()}><Copy size={14} />Copy</Button></div><p className="mt-2 text-[11px] text-slate-500">Valid until {new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(generated.expiresAt))}.</p></div> : <Button className="mt-3" disabled={working} onClick={() => void createCode()}>{working ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}Create linking code</Button>}
          </div>
        </div>
        {message ? <p className="text-xs text-cyan-100">{message}</p> : null}
      </div>
    </Panel>
  );
}
