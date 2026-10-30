"use client";

import { Minus, Plus, Undo2 } from "lucide-react";
import Image from "next/image";
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
  if (firstEnd !== null && current >= firstEnd) return Math.max(0, firstEnd - firstStart);
  return Math.max(0, current - firstStart);
}

export function formatMatchClock(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function BroadcastScoreboard({ match, currentTime, editable = false, saving = false, onChange, onUndo, onTeamColorChange }: {
  match: MatchRecord & { scoreEvents?: MatchScoreEventRecord[] };
  currentTime: number;
  editable?: boolean;
  saving?: boolean;
  onChange?: (score: BroadcastState) => void;
  onUndo?: () => void;
  onTeamColorChange?: (team: "home" | "away", color: string) => void;
}) {
  const score = scoreAtTime(match.scoreEvents || [], currentTime);
  const home = scoreboardTeamCode(match.homeClubShortName || match.homeClubName || match.teamName || "HOME");
  const away = scoreboardTeamCode(match.awayClubShortName || match.awayClubName || match.opponentName || "AWAY");
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

  return <div className="pointer-events-none absolute right-2 top-3 z-20 flex flex-col items-end gap-1 sm:right-3 sm:top-4">
    <div className="flex h-7 rounded-sm border border-black/35 bg-white text-white shadow-2xl backdrop-blur-sm">
      <span className="flex w-12 shrink-0 items-center justify-center rounded-l-[2px] bg-white font-mono text-[9px] font-black tracking-tight text-slate-950">{clock}</span>
      <ScoreboardTeam code={home} color={match.homeTeamColor} logo={match.homeClubLogoDataUrl} redCards={score.homeRedCards}/>
      <span className="flex h-full min-w-[3.75rem] items-center justify-center gap-1 bg-[#f2f4e8] px-2 text-[13px] font-black tabular-nums text-[#17221b]"><span>{score.homeScore}</span><span className="text-[10px] text-slate-500">-</span><span>{score.awayScore}</span></span>
      <ScoreboardTeam code={away} color={match.awayTeamColor} logo={match.awayClubLogoDataUrl} redCards={score.awayRedCards} last/>
    </div>
    {editable ? <div className="pointer-events-auto w-[12.5rem] rounded border border-white/15 bg-slate-950/92 p-1.5 text-white shadow-2xl backdrop-blur-sm">
      <p className="mb-1 text-center text-[7px] font-semibold uppercase tracking-[.12em] text-slate-500">Editing controls · not included in export</p>
      <div className="grid grid-cols-[minmax(2.5rem,1fr)_3.25rem_3.25rem] gap-1 border-b border-white/10 pb-0.5 text-center text-[7px] font-semibold uppercase tracking-wide text-slate-500"><span/><span>Goals</span><span>Red cards</span></div>
      <ScoreboardControlRow code={home} color={match.homeTeamColor} logo={match.homeClubLogoDataUrl} score={score.homeScore} redCards={score.homeRedCards} disabled={saving} onColorChange={(color) => onTeamColorChange?.("home", color)} onScoreMinus={() => changeScore("home", -1)} onScorePlus={() => changeScore("home", 1)} onCardMinus={() => changeRedCards("home", -1)} onCardPlus={() => changeRedCards("home", 1)}/>
      <ScoreboardControlRow code={away} color={match.awayTeamColor} logo={match.awayClubLogoDataUrl} score={score.awayScore} redCards={score.awayRedCards} disabled={saving} onColorChange={(color) => onTeamColorChange?.("away", color)} onScoreMinus={() => changeScore("away", -1)} onScorePlus={() => changeScore("away", 1)} onCardMinus={() => changeRedCards("away", -1)} onCardPlus={() => changeRedCards("away", 1)}/>
      {(match.scoreEvents?.length || 0) > 0 ? <Button size="sm" variant="ghost" className="mt-1 h-6 w-full justify-center px-1.5 text-[9px]" disabled={saving} onClick={onUndo} title="Undo latest scoreboard change"><Undo2 size={10}/>Undo latest change</Button> : null}
    </div> : null}
  </div>;
}

function ScoreboardTeam({ code, color, logo, redCards, last = false }: { code: string; color: string; logo: string | null; redCards: number; last?: boolean }) {
  const textColor = readableTextColor(color);
  return <span className="relative isolate flex min-w-[3.75rem] items-center justify-center gap-1.5 px-1.5 text-[10px] font-extrabold tracking-wide" style={{ color: textColor }}>{redCards > 0 ? <span className="absolute -top-1.5 left-1.5 z-0 flex gap-0.5" title="Red cards">{Array.from({ length: redCards }, (_, index) => <span key={index} className="h-3 w-1.5 rounded-[1px] bg-red-500 shadow-sm shadow-black"/>)}</span> : null}<span className={`absolute inset-0 z-10 ${last ? "rounded-r-[2px]" : ""}`} style={{ backgroundColor: color }}/><TeamEmblem code={code} logo={logo}/><span className="relative z-20 leading-none drop-shadow-sm">{code}</span></span>;
}

function TeamEmblem({ code, logo }: { code: string; logo: string | null }) {
  return <span className="relative z-20 flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/20 bg-white p-[1px] shadow-sm">{logo ? <Image src={logo} alt="" width={16} height={16} unoptimized className="h-full w-full rounded-full object-contain"/> : <span className="text-[6px] font-black text-slate-700">{code.slice(0, 1)}</span>}</span>;
}

function ScoreboardControlRow({ code, color, logo, score, redCards, disabled, onColorChange, onScoreMinus, onScorePlus, onCardMinus, onCardPlus }: { code: string; color: string; logo: string | null; score: number; redCards: number; disabled: boolean; onColorChange: (color: string) => void; onScoreMinus: () => void; onScorePlus: () => void; onCardMinus: () => void; onCardPlus: () => void }) {
  return <div className="grid grid-cols-[minmax(2.5rem,1fr)_3.25rem_3.25rem] items-center gap-1 py-0.5"><span className="flex min-w-0 items-center gap-1 text-[9px] font-bold tracking-wide"><span className="flex h-3 w-3 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-white p-px">{logo ? <Image src={logo} alt="" width={12} height={12} unoptimized className="h-full w-full object-contain"/> : <span className="h-full w-full rounded-full bg-slate-400"/>}</span><span className="min-w-0 flex-1 truncate">{code}</span><label className="pointer-events-auto relative h-4 w-4 shrink-0 cursor-pointer overflow-hidden rounded border border-white/35 shadow-sm" title="Match color" style={{ backgroundColor: color }}><input type="color" value={color} disabled={disabled} onChange={(event) => onColorChange(event.target.value.toUpperCase())} aria-label={`${code} match color`} className="absolute -inset-2 h-8 w-8 cursor-pointer opacity-0 disabled:cursor-wait"/></label></span><ScoreButtons score={score} disabled={disabled} onMinus={onScoreMinus} onPlus={onScorePlus}/><RedCardButtons count={redCards} disabled={disabled} onMinus={onCardMinus} onPlus={onCardPlus}/></div>;
}

function ScoreButtons({ score, disabled, onMinus, onPlus }: { score: number; disabled: boolean; onMinus: () => void; onPlus: () => void }) {
  const button = "flex h-5 w-[17px] items-center justify-center bg-white/[.06] text-slate-200 transition hover:bg-white/[.16] hover:text-white disabled:opacity-40";
  return <span className="pointer-events-auto flex overflow-hidden rounded border border-white/20" title="Goals"><button type="button" disabled={disabled || score === 0} onClick={onMinus} className={button} aria-label="Decrease score"><Minus size={9}/></button><span className="flex h-5 min-w-[16px] items-center justify-center border-x border-white/15 text-[10px] font-black">{score}</span><button type="button" disabled={disabled} onClick={onPlus} className={button} aria-label="Increase score"><Plus size={9}/></button></span>;
}

function RedCardButtons({ count, disabled, onMinus, onPlus }: { count: number; disabled: boolean; onMinus: () => void; onPlus: () => void }) {
  const button = "flex h-5 w-[17px] items-center justify-center bg-red-500/[.06] text-red-100 transition hover:bg-red-500/20 disabled:opacity-40";
  return <span className="pointer-events-auto flex overflow-hidden rounded border border-red-400/35" title="Red cards"><button type="button" disabled={disabled || count === 0} onClick={onMinus} className={button} aria-label="Remove red card"><Minus size={9}/></button><span className="flex h-5 min-w-[16px] items-center justify-center gap-0.5 border-x border-red-400/25 text-[8px] font-bold"><span className="h-2.5 w-1.5 rounded-[1px] bg-red-500 shadow-sm shadow-red-950"/>{count}</span><button type="button" disabled={disabled} onClick={onPlus} className={button} aria-label="Add red card"><Plus size={9}/></button></span>;
}

function scoreboardTeamCode(value: string) {
  const normalized = value.trim().toUpperCase();
  if (normalized.length <= 4) return normalized;
  const initials = normalized.split(/\s+/).filter(Boolean).map((part) => part[0]).join("");
  return (initials.length >= 2 ? initials : normalized).slice(0, 4);
}

function readableTextColor(color: string) {
  const hex = color.replace("#", "");
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return "#FFFFFF";
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return red * .299 + green * .587 + blue * .114 > 160 ? "#111827" : "#FFFFFF";
}
