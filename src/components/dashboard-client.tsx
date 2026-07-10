"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Calendar, Clapperboard, Pencil, Play, Plus, Trash2 } from "lucide-react";

import { apiFetch } from "@/lib/http";
import type { MatchSummary } from "@/lib/domain";
import { formatTime } from "@/lib/time";
import { Badge, Button, Panel } from "@/components/ui";

export function DashboardClient() {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(
    () => ({
      matches: matches.length,
      moments: matches.reduce((sum, match) => sum + match.momentCount, 0),
      withVideo: matches.filter((match) => match.video).length,
    }),
    [matches],
  );

  useEffect(() => {
    apiFetch<MatchSummary[]>("/api/matches")
      .then(setMatches)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(match: MatchSummary) {
    const confirmed = window.confirm(`Delete "${match.title}" and all associated moments?`);
    if (!confirmed) {
      return;
    }

    await apiFetch<void>(`/api/matches/${match.id}`, { method: "DELETE" });
    setMatches((current) => current.filter((item) => item.id !== match.id));
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="rounded-lg border border-white/10 bg-gradient-to-br from-white/[0.08] to-cyan-300/[0.04] p-5 shadow-panel">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-cyan-200/80">Analysis hub</p>
              <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Matches and opponents</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Open an analysis, select the local video in the browser and tag tactical moments without uploading the file.
              </p>
            </div>
            <Link href="/matches/new" className="shrink-0">
              <Button variant="primary">
                <Plus size={17} />
                Create new match
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
          <Stat label="Matches" value={totals.matches} />
          <Stat label="Moments" value={totals.moments} />
          <Stat label="With video" value={totals.withVideo} />
        </div>
      </section>

      {error ? (
        <Panel className="border-red-400/30 p-4 text-sm text-red-100">{error}</Panel>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <Panel key={index} className="h-56 animate-pulse bg-white/[0.035]" />
          ))
        ) : matches.length === 0 ? (
          <Panel className="md:col-span-2 xl:col-span-3">
            <div className="flex min-h-72 flex-col items-center justify-center px-5 text-center">
              <Clapperboard className="text-cyan-200" size={42} />
              <h2 className="mt-4 text-lg font-semibold text-white">No analyses yet</h2>
              <p className="mt-2 max-w-md text-sm text-slate-400">
                Create the first match to start tagging organization, transition and set-piece moments.
              </p>
              <Link href="/matches/new" className="mt-5">
                <Button variant="primary">
                  <Plus size={17} />
                  New match
                </Button>
              </Link>
            </div>
          </Panel>
        ) : (
          matches.map((match) => (
            <Panel key={match.id} className="flex min-h-60 flex-col justify-between overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-white">{match.title}</h2>
                    <p className="mt-1 truncate text-sm text-slate-400">{match.opponentName}</p>
                  </div>
                  <Badge className="shrink-0 border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                    {match.momentCount} {match.momentCount === 1 ? "moment" : "moments"}
                  </Badge>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-slate-400">
                  <Info icon={<Calendar size={15} />} value={formatDate(match.matchDate)} />
                  <Info icon={<Clapperboard size={15} />} value={match.competition ?? "Competition not set"} />
                  {match.video ? (
                    <Info icon={<Play size={15} />} value={`${match.video.fileName} - ${formatTime(match.video.durationSeconds)}`} />
                  ) : (
                    <Info icon={<Play size={15} />} value="Local video not validated yet" />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-white/10 bg-black/10 p-3">
                <Link href={`/analysis/${match.id}`} className="min-w-0 flex-1">
                  <Button variant="primary" className="w-full">
                    <Play size={16} />
                    Open analysis
                  </Button>
                </Link>
                <Link href={`/matches/${match.id}/edit`}>
                  <Button variant="secondary" size="icon" aria-label="Edit match">
                    <Pencil size={16} />
                  </Button>
                </Link>
                <Button variant="danger" size="icon" aria-label="Delete match" onClick={() => void handleDelete(match)}>
                  <Trash2 size={16} />
                </Button>
              </div>
            </Panel>
          ))
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Panel className="p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </Panel>
  );
}

function Info({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="text-cyan-200/80">{icon}</span>
      <span className="truncate">{value}</span>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "Date not set";
  }

  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}
