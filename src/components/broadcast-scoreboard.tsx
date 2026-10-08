"use client";

import { Minus, Plus, Undo2 } from "lucide-react";
import { Button } from "@/components/ui";
import type { MatchRecord, MatchScoreEventRecord } from "@/lib/domain";

type Score = { homeScore: number; awayScore: number };

export function scoreAtTime(events: MatchScoreEventRecord[], timeSeconds: number): Score {
  const ordered = [...events].sort((a, b) => a.timeSeconds - b.timeSeconds || a.createdAt.localeCompare(b.createdAt));
  let score: Score = { homeScore: 0, awayScore: 0 };
  for (const event of ordered) {
    if (event.timeSeconds > timeSeconds + .05) break;
    score = { homeScore: event.homeScore, awayScore: event.awayScore };
  }
  return score;
}

export function matchClockSeconds(match: MatchRecord, videoTimeSeconds: number) {
  const current = Math.max(0, videoTimeSeconds);
  const firstStart = match.firstHalfStartSeconds;
  const firstEnd = match.firstHalfEndSeconds;
  const secondStart = match.secondHalfStartSeconds;
  const secondEnd = match.secondHalfEndSeconds;
  if (firstStart === null) return 0;
  if (current < firstStart) return 0;
  if (secondStart !== null && current >= secondStart) {
    const effective = secondEnd !== null ? Math.min(current, secondEnd) : current;
    return 45 * 60 + Math.max(0, effective - secondStart);
  }
  if (firstEnd !== null && current >= firstEnd) return 45 * 60;
  return Math.max(0, current - firstStart);
}

export function formatMatchClock(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function BroadcastScoreboard({ match, currentTime, editable = false, saving = false, onChange, onUndo }: {
  match: MatchRecord & { scoreEvents?: MatchScoreEventRecord[] };
  currentTime: number;
  editable?: boolean;
  saving?: boolean;
  onChange?: (score: Score) => void;
  onUndo?: () => void;
}) {
  const score = scoreAtTime(match.scoreEvents || [], currentTime);
  const home = match.homeClubShortName || match.homeClubName || match.teamName || "HOME";
  const away = match.awayClubShortName || match.awayClubName || match.opponentName || "AWAY";
  const clock = formatMatchClock(matchClockSeconds(match, currentTime));
  const change = (team: "home" | "away", delta: number) => {
    onChange?.({
      homeScore: team === "home" ? Math.max(0, score.homeScore + delta) : score.homeScore,
      awayScore: team === "away" ? Math.max(0, score.awayScore + delta) : score.awayScore,
    });
  };

  return <div className="pointer-events-none absolute right-3 top-3 z-20 flex flex-col items-end gap-1.5 sm:right-4 sm:top-4">
    <div className="overflow-hidden rounded-md border border-white/20 bg-slate-950/92 text-white shadow-2xl backdrop-blur-sm">
      <div className="bg-cyan-300 px-3 py-0.5 text-right font-mono text-[10px] font-bold tracking-wide text-slate-950">{clock}</div>
      <div className="grid grid-cols-[minmax(4.5rem,auto)_2rem_2rem] items-center gap-x-1 px-2 py-1.5 text-xs font-semibold">
        <TeamCell name={home} logo={match.homeClubLogoDataUrl}/><span className="text-center text-base font-black">{score.homeScore}</span>{editable ? <ScoreButtons disabled={saving} onMinus={() => change("home", -1)} onPlus={() => change("home", 1)}/> : <span/>}
        <TeamCell name={away} logo={match.awayClubLogoDataUrl}/><span className="text-center text-base font-black">{score.awayScore}</span>{editable ? <ScoreButtons disabled={saving} onMinus={() => change("away", -1)} onPlus={() => change("away", 1)}/> : <span/>}
      </div>
    </div>
    {editable && (match.scoreEvents?.length || 0) > 0 ? <Button size="sm" variant="secondary" className="pointer-events-auto h-7 bg-slate-950/90 px-2 text-[10px]" disabled={saving} onClick={onUndo} title="Undo the latest score change"><Undo2 size={11}/>Undo score</Button> : null}
  </div>;
}

function TeamCell({ name, logo }: { name: string; logo: string | null }) {
  return <span className="flex min-w-0 items-center gap-1.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded bg-white/10">{logo ? <img src={logo} alt="" className="h-full w-full object-contain"/> : <span className="text-[7px] font-bold text-slate-300">{name.slice(0, 2).toUpperCase()}</span>}</span><span className="max-w-28 truncate">{name}</span></span>;
}

function ScoreButtons({ disabled, onMinus, onPlus }: { disabled: boolean; onMinus: () => void; onPlus: () => void }) {
  return <span className="pointer-events-auto flex overflow-hidden rounded border border-white/15"><button type="button" disabled={disabled} onClick={onMinus} className="flex h-5 w-5 items-center justify-center bg-white/[.06] hover:bg-white/[.14] disabled:opacity-40" aria-label="Decrease score"><Minus size={9}/></button><button type="button" disabled={disabled} onClick={onPlus} className="flex h-5 w-5 items-center justify-center border-l border-white/15 bg-white/[.06] hover:bg-white/[.14] disabled:opacity-40" aria-label="Increase score"><Plus size={9}/></button></span>;
}
