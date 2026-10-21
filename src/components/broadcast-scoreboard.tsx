"use client";

import { Minus, Plus, Undo2 } from "lucide-react";
import { Button } from "@/components/ui";
import type { MatchRecord, MatchScoreEventRecord } from "@/lib/domain";

export type BroadcastState = { homeScore: number; awayScore: number; homeRedCards: number; awayRedCards: number };

export function scoreAtTime(events: MatchScoreEventRecord[], timeSeconds: number): BroadcastState {
  const ordered = [...events].sort((a, b) => a.timeSeconds - b.timeSeconds || a.createdAt.localeCompare(b.createdAt));
  let score: BroadcastState = { homeScore: 0, awayScore: 0, homeRedCards: 0, awayRedCards: 0 };
  for (const event of ordered) {
    if (event.timeSeconds > timeSeconds + .05) break;
    score = { homeScore: event.homeScore, awayScore: event.awayScore, homeRedCards: event.homeRedCards || 0, awayRedCards: event.awayRedCards || 0 };
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
  onChange?: (score: BroadcastState) => void;
  onUndo?: () => void;
}) {
  const score = scoreAtTime(match.scoreEvents || [], currentTime);
  const home = match.homeClubShortName || match.homeClubName || match.teamName || "HOME";
  const away = match.awayClubShortName || match.awayClubName || match.opponentName || "AWAY";
  const clock = formatMatchClock(matchClockSeconds(match, currentTime));
  const changeScore = (team: "home" | "away", delta: number) => {
    onChange?.({
      ...score,
      homeScore: team === "home" ? Math.max(0, score.homeScore + delta) : score.homeScore,
      awayScore: team === "away" ? Math.max(0, score.awayScore + delta) : score.awayScore,
    });
  };
  const changeRedCards = (team: "home" | "away", delta: number) => {
    onChange?.({
      ...score,
      homeRedCards: team === "home" ? Math.max(0, score.homeRedCards + delta) : score.homeRedCards,
      awayRedCards: team === "away" ? Math.max(0, score.awayRedCards + delta) : score.awayRedCards,
    });
  };

  return <div className="pointer-events-none absolute right-2 top-1 z-20 flex flex-col items-end gap-1 sm:right-3 sm:top-2">
    <div className={`overflow-hidden rounded border border-white/20 bg-slate-950/92 text-white shadow-2xl backdrop-blur-sm ${editable ? "min-w-[13.75rem]" : "min-w-[8.25rem]"}`}>
      <div className="bg-cyan-300 px-2 py-px text-right font-mono text-[8px] font-bold tracking-wide text-slate-950">{clock}</div>
      {editable ? <div className="grid grid-cols-[minmax(4rem,1fr)_3.75rem_3.75rem] items-center gap-x-1 gap-y-1 px-1.5 py-1 text-[10px] font-semibold">
        <TeamCell name={home} logo={match.homeClubLogoDataUrl} color={match.homeClubColor} redCards={0}/><ScoreButtons score={score.homeScore} disabled={saving} onMinus={() => changeScore("home", -1)} onPlus={() => changeScore("home", 1)}/><RedCardButtons count={score.homeRedCards} disabled={saving} onMinus={() => changeRedCards("home", -1)} onPlus={() => changeRedCards("home", 1)}/>
        <TeamCell name={away} logo={match.awayClubLogoDataUrl} color={match.awayClubColor} redCards={0}/><ScoreButtons score={score.awayScore} disabled={saving} onMinus={() => changeScore("away", -1)} onPlus={() => changeScore("away", 1)}/><RedCardButtons count={score.awayRedCards} disabled={saving} onMinus={() => changeRedCards("away", -1)} onPlus={() => changeRedCards("away", 1)}/>
      </div> : <div className="grid grid-cols-[minmax(3.75rem,auto)_1.5rem] items-center gap-x-1 px-1.5 py-1 text-[10px] font-semibold">
        <TeamCell name={home} logo={match.homeClubLogoDataUrl} color={match.homeClubColor} redCards={score.homeRedCards}/><span className="text-center text-sm font-black">{score.homeScore}</span>
        <TeamCell name={away} logo={match.awayClubLogoDataUrl} color={match.awayClubColor} redCards={score.awayRedCards}/><span className="text-center text-sm font-black">{score.awayScore}</span>
      </div>}
    </div>
    {editable && (match.scoreEvents?.length || 0) > 0 ? <Button size="sm" variant="secondary" className="pointer-events-auto h-6 bg-slate-950/90 px-1.5 text-[9px]" disabled={saving} onClick={onUndo} title="Undo latest scoreboard change"><Undo2 size={10}/>Undo latest change</Button> : null}
  </div>;
}

function TeamCell({ name, logo, color, redCards }: { name: string; logo: string | null; color: string | null; redCards: number }) {
  return <span className="flex min-w-0 items-center gap-1"><span className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/30 shadow-sm" style={{ backgroundColor: color || "#64748B" }}/><span className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/10">{logo ? <img src={logo} alt="" className="h-full w-full object-contain"/> : <span className="text-[6px] font-bold text-slate-300">{name.slice(0, 2).toUpperCase()}</span>}</span><span className="max-w-20 truncate">{name}</span>{redCards > 0 ? <span className="ml-auto inline-flex items-center gap-0.5" title="Red cards"><span className="h-3 w-1.5 rounded-[1px] bg-red-500 shadow-sm shadow-red-950"/><span className="text-[8px] font-bold text-red-200">{redCards}</span></span> : null}</span>;
}

function ScoreButtons({ score, disabled, onMinus, onPlus }: { score: number; disabled: boolean; onMinus: () => void; onPlus: () => void }) {
  const button = "flex h-6 w-5 items-center justify-center bg-white/[.06] text-slate-200 transition hover:bg-white/[.16] hover:text-white disabled:opacity-40";
  return <span className="pointer-events-auto flex overflow-hidden rounded border border-white/20" title="Goals"><button type="button" disabled={disabled || score === 0} onClick={onMinus} className={button} aria-label="Decrease score"><Minus size={10}/></button><span className="flex h-6 min-w-5 items-center justify-center border-x border-white/15 text-xs font-black">{score}</span><button type="button" disabled={disabled} onClick={onPlus} className={button} aria-label="Increase score"><Plus size={10}/></button></span>;
}

function RedCardButtons({ count, disabled, onMinus, onPlus }: { count: number; disabled: boolean; onMinus: () => void; onPlus: () => void }) {
  const button = "flex h-6 w-5 items-center justify-center bg-red-500/[.06] text-red-100 transition hover:bg-red-500/20 disabled:opacity-40";
  return <span className="pointer-events-auto flex overflow-hidden rounded border border-red-400/35" title="Red cards"><button type="button" disabled={disabled || count === 0} onClick={onMinus} className={button} aria-label="Remove red card"><Minus size={10}/></button><span className="flex h-6 min-w-5 items-center justify-center gap-0.5 border-x border-red-400/25 text-[9px] font-bold"><span className="h-3 w-1.5 rounded-[1px] bg-red-500 shadow-sm shadow-red-950"/>{count}</span><button type="button" disabled={disabled} onClick={onPlus} className={button} aria-label="Add red card"><Plus size={10}/></button></span>;
}
