"use client";

import { useState } from "react";

import { Button, FieldLabel, Panel, TextInput } from "@/components/ui";
import type { MatchDetail, UpdateMatchInput } from "@/lib/domain";
import { apiFetch } from "@/lib/http";

type Team = "home" | "away";
type TeamSettings = { name: string; shortName: string; color: string; badge: string | null };

export function ScoreboardSettings({ match, onSaved, onClose }: { match: MatchDetail; onSaved: (match: MatchDetail) => void; onClose: () => void }) {
  const [enabled, setEnabled] = useState(match.scoreboardEnabled);
  const [teams, setTeams] = useState<Record<Team, TeamSettings>>({
    home: { name: match.homeClubName || match.teamName || "Home", shortName: match.homeClubShortName || "", color: match.homeTeamColor, badge: match.homeClubLogoDataUrl },
    away: { name: match.awayClubName || match.opponentName || "Away", shortName: match.awayClubShortName || "", color: match.awayTeamColor, badge: match.awayClubLogoDataUrl },
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateTeam(team: Team, patch: Partial<TeamSettings>) {
    setTeams((current) => ({ ...current, [team]: { ...current[team], ...patch } }));
  }

  async function uploadBadge(team: Team, file?: File) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 250_000) {
      setError("Use a PNG, JPEG or WebP badge smaller than 250 KB.");
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read the badge."));
        reader.readAsDataURL(file);
      });
      updateTeam(team, { badge: dataUrl });
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read the badge.");
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const input: UpdateMatchInput = {
      scoreboardEnabled: enabled,
      homeClubName: teams.home.name,
      awayClubName: teams.away.name,
      homeClubShortName: teams.home.shortName,
      awayClubShortName: teams.away.shortName,
      homeTeamColor: teams.home.color,
      awayTeamColor: teams.away.color,
      homeClubLogoDataUrl: teams.home.badge,
      awayClubLogoDataUrl: teams.away.badge,
    };
    try {
      onSaved(await apiFetch<MatchDetail>(`/api/matches/${match.id}`, { method: "PATCH", body: JSON.stringify(input) }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save scoreboard settings.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Match scoreboard">
    <Panel className="max-h-[90vh] w-full max-w-xl overflow-y-auto p-5">
      <h2 className="text-lg font-bold text-white">Match scoreboard</h2>
      <form onSubmit={save} className="mt-4 grid gap-4">
        <label className="flex items-start gap-2 text-sm text-slate-200"><input className="mt-0.5 h-4 w-4 accent-cyan-300" type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />Show scoreboard and match clock for this match</label>
        <p className="text-xs leading-5 text-slate-400">Enable it only when the original video does not already include a scoreboard. Scores and red cards are saved at the current video time.</p>
        <div className="grid gap-4 sm:grid-cols-2">{(["home", "away"] as const).map((team) => <fieldset key={team} className="grid gap-3 rounded border border-white/10 p-3"><legend className="px-1 text-sm font-semibold text-white">{team === "home" ? "Home" : "Away"}</legend>
          <label className="grid gap-1"><FieldLabel>Club name</FieldLabel><TextInput required maxLength={100} value={teams[team].name} onChange={(event) => updateTeam(team, { name: event.target.value })} /></label>
          <label className="grid gap-1"><FieldLabel>Short name (optional)</FieldLabel><TextInput maxLength={4} value={teams[team].shortName} onChange={(event) => updateTeam(team, { shortName: event.target.value })} /></label>
          <label className="flex items-center gap-2"><FieldLabel>Match color</FieldLabel><input type="color" value={teams[team].color} onChange={(event) => updateTeam(team, { color: event.target.value.toUpperCase() })} /></label>
          <label className="grid gap-1"><FieldLabel>Club badge</FieldLabel><input className="w-full text-xs text-slate-300" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadBadge(team, event.target.files?.[0])} /></label>
          {teams[team].badge ? <Button type="button" size="sm" onClick={() => updateTeam(team, { badge: null })}>Remove badge</Button> : null}
        </fieldset>)}</div>
        {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
        <div className="flex justify-end gap-2"><Button type="button" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Save"}</Button></div>
      </form>
    </Panel>
  </div>;
}
