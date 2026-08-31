"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Calendar, Clapperboard, Pencil, Play, Plus, Search, Trash2, Users, X } from "lucide-react";

import { apiFetch } from "@/lib/http";
import type { MatchAnalysisPerspective, MatchAnalysisRecord, MatchSummary } from "@/lib/domain";
import { formatTime } from "@/lib/time";
import { Badge, Button, Panel, TextInput } from "@/components/ui";

export function DashboardClient() {
  const router = useRouter();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openingMatch, setOpeningMatch] = useState<MatchSummary | null>(null);
  const [savingPerspective, setSavingPerspective] = useState<MatchAnalysisPerspective | null>(null);

  const analysisCards = useMemo(
    () => matches.flatMap((match) => match.analyses.map((analysis) => ({ match, analysis }))),
    [matches],
  );

  const filteredMatches = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return analysisCards;

    return analysisCards.filter(({ match, analysis }) =>
      [match.title, match.teamName, match.opponentName, match.competition, analysis.analysedTeamName]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [analysisCards, query]);

  const totals = useMemo(
    () => ({
      matches: matches.length,
      moments: matches.reduce((sum, match) => sum + match.momentCount, 0),
      withVideo: matches.filter((match) => match.video?.storageStatus === "READY").length,
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
    const confirmed = window.confirm(`Delete "${match.title}", all saved perspectives and all associated moments?`);
    if (!confirmed) {
      return;
    }

    await apiFetch<void>(`/api/matches/${match.id}`, { method: "DELETE" });
    setMatches((current) => current.filter((item) => item.id !== match.id));
  }

  function openAnalysis(match: MatchSummary, analysis: MatchAnalysisRecord) {
    if (match.analyses.length > 1) {
      router.push(`/analysis/${match.id}?perspective=${analysis.perspective}`);
      return;
    }

    setOpeningMatch(match);
  }

  async function openPerspective(perspective: MatchAnalysisPerspective) {
    if (!openingMatch || savingPerspective) return;
    setSavingPerspective(perspective);
    setError(null);
    try {
      const analysis = await apiFetch<MatchAnalysisRecord>(`/api/matches/${openingMatch.id}/analyses`, {
        method: "POST",
        body: JSON.stringify({ perspective }),
      });
      const matchId = openingMatch.id;
      setMatches((current) => current.map((match) => match.id === matchId ? {
        ...match,
        analyses: match.analyses.some((item) => item.id === analysis.id)
          ? match.analyses
          : [...match.analyses, analysis],
      } : match));
      setOpeningMatch(null);
      router.push(`/analysis/${matchId}?perspective=${perspective}`);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Could not save the analysis perspective.");
    } finally {
      setSavingPerspective(null);
    }
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
                Upload each match video once, keep it private in Cloudflare R2 and continue the analysis from any authorised device.
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

      {!loading && matches.length > 0 ? (
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
          <TextInput
            aria-label="Search matches"
            className="pl-10"
            placeholder="Search by team, opponent or title"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
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
        ) : filteredMatches.length === 0 ? (
          <Panel className="md:col-span-2 xl:col-span-3 p-8 text-center text-sm text-slate-400">
            No matches found for “{query}”.
          </Panel>
        ) : (
          filteredMatches.map(({ match, analysis }) => (
            <Panel key={analysis.id} className="flex min-h-60 flex-col justify-between overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-white">{match.title}</h2>
                    <p className="mt-1 truncate text-sm text-slate-400">
                      {match.teamName ? `${match.teamName} vs ${match.opponentName}` : match.opponentName}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5"><Badge className="border-cyan-300/25 bg-cyan-300/10 text-cyan-100">Analysing: {analysis.analysedTeamName}</Badge><span className="text-[10px] text-slate-500">{match.momentCount} {match.momentCount === 1 ? "moment" : "moments"}</span></div>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-slate-400">
                  <Info icon={<Calendar size={15} />} value={formatDate(match.matchDate)} />
                  <Info icon={<Clapperboard size={15} />} value={match.competition ?? "Competition not set"} />
                  {match.video?.storageStatus === "READY" ? (
                    <Info icon={<Play size={15} />} value={`${match.video.fileName} - ${formatTime(match.video.durationSeconds)}`} />
                  ) : match.video?.storageStatus === "UPLOADING" ? (
                    <Info icon={<Play size={15} />} value="Cloud upload incomplete" />
                  ) : (
                    <Info icon={<Play size={15} />} value="No cloud video uploaded yet" />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-white/10 bg-black/10 p-3">
                <div className="min-w-0 flex-1">
                  <Button variant="primary" className="w-full" onClick={() => openAnalysis(match, analysis)}>
                    <Play size={16} />
                    Open analysis
                  </Button>
                </div>
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

      {openingMatch ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Choose the team to analyse">
          <Panel className="w-full max-w-xl overflow-hidden border-cyan-300/25">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <div>
                <div className="flex items-center gap-2 text-cyan-200"><Users size={17} /><span className="text-xs font-semibold uppercase tracking-[.2em]">Analysis perspective</span></div>
                <h2 className="mt-2 text-xl font-semibold text-white">Which team do you want to analyse?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Choose the team you want to study as the opponent. The same saved moments will automatically be shown from that team&apos;s perspective.</p>
              </div>
              <Button size="icon" variant="ghost" aria-label="Close" onClick={() => setOpeningMatch(null)}><X size={17} /></Button>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {openingMatch.teamName ? (
                <button type="button" disabled={Boolean(savingPerspective)} className="group rounded-lg border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-cyan-300/45 hover:bg-cyan-300/[.08] disabled:cursor-wait disabled:opacity-60" onClick={() => void openPerspective("team")}>
                  <span className="text-xs uppercase tracking-[.16em] text-slate-500">Analyse as opponent</span>
                  <span className="mt-2 flex items-center justify-between gap-3 text-lg font-semibold text-white"><span className="truncate">{openingMatch.teamName}</span><ArrowRight size={18} className="shrink-0 text-cyan-300 transition group-hover:translate-x-1" /></span>
                  <span className="mt-2 block text-xs leading-5 text-slate-500">Organization, transitions, set pieces and results are shown in the reversed perspective.</span>
                </button>
              ) : null}
              <button type="button" disabled={Boolean(savingPerspective)} className="group rounded-lg border border-white/10 bg-white/[.035] p-4 text-left transition hover:border-cyan-300/45 hover:bg-cyan-300/[.08] disabled:cursor-wait disabled:opacity-60" onClick={() => void openPerspective("opponent")}>
                <span className="text-xs uppercase tracking-[.16em] text-slate-500">Analyse as opponent</span>
                <span className="mt-2 flex items-center justify-between gap-3 text-lg font-semibold text-white"><span className="truncate">{openingMatch.opponentName}</span><ArrowRight size={18} className="shrink-0 text-cyan-300 transition group-hover:translate-x-1" /></span>
                <span className="mt-2 block text-xs leading-5 text-slate-500">Uses the original perspective in which the moments are stored.</span>
              </button>
            </div>
            <p className="border-t border-white/10 px-5 py-3 text-xs text-slate-500">This perspective is saved for Dashboard and Reports. Both perspectives share the same video and moments, so no cloud file is duplicated.</p>
          </Panel>
        </div>
      ) : null}
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
