"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";

import type { CreateMatchInput, MaintenanceRecord, MatchDetail, MatchRecord } from "@/lib/domain";
import { apiFetch } from "@/lib/http";
import { Button, FieldLabel, Panel, Select, TextArea, TextInput } from "@/components/ui";

type MatchFormProps = {
  mode: "create" | "edit";
  matchId?: string;
};

const emptyForm: CreateMatchInput = {
  title: "",
  teamName: "",
  opponentName: "",
  matchDate: "",
  competition: "",
  venue: "",
  notes: "",
  roundName: "",
  seasonId: "",
  homeClubId: "",
  awayClubId: "",
  competitionId: "",
};

export function MatchForm({ mode, matchId }: MatchFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<CreateMatchInput>(emptyForm);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<MaintenanceRecord[]>([]);
  const [clubs, setClubs] = useState<MaintenanceRecord[]>([]);
  const [competitions, setCompetitions] = useState<MaintenanceRecord[]>([]);

  useEffect(() => { Promise.all([apiFetch<MaintenanceRecord[]>("/api/maintenance/seasons"),apiFetch<MaintenanceRecord[]>("/api/maintenance/clubs"),apiFetch<MaintenanceRecord[]>("/api/maintenance/competitions")]).then(([s,c,co])=>{setSeasons(s);setClubs(c);setCompetitions(co)}).catch((err:Error)=>setError(err.message)); }, []);

  useEffect(() => {
    if (mode !== "edit" || !matchId) {
      return;
    }

    apiFetch<MatchDetail>(`/api/matches/${matchId}`)
      .then((match) =>
        setForm({
          title: match.title,
          teamName: match.teamName ?? "",
          opponentName: match.opponentName,
          matchDate: match.matchDate?.slice(0, 10) ?? "",
          competition: match.competition ?? "",
          venue: match.venue ?? "",
          notes: match.notes ?? "",
          roundName: match.roundName ?? "",
          seasonId: match.seasonId ?? "",
          homeClubId: match.homeClubId ?? "",
          awayClubId: match.awayClubId ?? "",
          competitionId: match.competitionId ?? "",
        }),
      )
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [matchId, mode]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = { ...form, title: `Round ${form.roundName} - ${form.teamName} vs ${form.opponentName}` };
      const saved =
        mode === "create"
          ? await apiFetch<MatchRecord>("/api/matches", { method: "POST", body: JSON.stringify(payload) })
          : await apiFetch<MatchRecord>(`/api/matches/${matchId}`, { method: "PATCH", body: JSON.stringify(payload) });

      router.push(`/analysis/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving match.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-200/80">
            {mode === "create" ? "New analysis" : "Edit analysis"}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white">{mode === "create" ? "Create match" : "Edit match"}</h1>
        </div>
        <Link href="/">
          <Button variant="ghost">
            <ArrowLeft size={16} />
            Back
          </Button>
        </Link>
      </div>

      <Panel className="p-5">
        {loading ? (
          <div className="h-96 animate-pulse rounded-lg bg-white/[0.04]" />
        ) : (
          <form className="grid gap-5" onSubmit={handleSubmit}>
            {error ? <div className="rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</div> : null}

            <div className="grid gap-4 md:grid-cols-2">
              <Field name="roundName" label="Round" value={form.roundName ?? ""} onChange={setForm} type="number" required />
              <Choice label="Season" value={form.seasonId ?? ""} items={seasons} required onChange={id=>setForm(f=>({...f,seasonId:id,competitionId:"",competition:"",homeClubId:"",awayClubId:"",teamName:"",opponentName:""}))} />
              <Choice label="Competition" value={form.competitionId ?? ""} items={competitions.filter(item=>item.seasonId===form.seasonId)} required disabled={!form.seasonId} onChange={id=>{const item=competitions.find(x=>x.id===id);setForm(f=>({...f,competitionId:id,competition:item?.name||"",homeClubId:"",awayClubId:"",teamName:"",opponentName:""}))}} />
              <Choice label="Home team" value={form.homeClubId ?? ""} items={clubs.filter(club=>competitions.find(item=>item.id===form.competitionId)?.clubIds?.includes(club.id))} required disabled={!form.competitionId} onChange={id=>{const club=clubs.find(x=>x.id===id);setForm(f=>({...f,homeClubId:id,teamName:club?.name||""}))}} />
              <Choice label="Away team" value={form.awayClubId ?? ""} items={clubs.filter(club=>competitions.find(item=>item.id===form.competitionId)?.clubIds?.includes(club.id))} required disabled={!form.competitionId} onChange={id=>{const club=clubs.find(x=>x.id===id);setForm(f=>({...f,awayClubId:id,opponentName:club?.name||""}))}} />
              <Field name="matchDate" label="Date" value={form.matchDate ?? ""} onChange={setForm} type="date" required />
              <Field name="venue" label="Venue" value={form.venue ?? ""} onChange={setForm} />
            </div>

            <div className="grid gap-2">
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <TextArea
                id="notes"
                value={form.notes ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Opponent context, observations or analysis goals"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Link href="/">
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" variant="primary" disabled={saving}>
                <Save size={16} />
                {saving ? "Saving" : "Save and open analysis"}
              </Button>
            </div>
          </form>
        )}
      </Panel>
    </div>
  );
}

function Choice({label,value,items,onChange,required=false,disabled=false}:{label:string;value:string;items:MaintenanceRecord[];onChange:(value:string)=>void;required?:boolean;disabled?:boolean}) { return <label className="grid gap-2"><FieldLabel>{label}</FieldLabel><Select value={value} required={required} disabled={disabled} onChange={e=>onChange(e.target.value)}><option value="">Select…</option>{items.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</Select>{!disabled&&items.length===0?<span className="text-xs text-amber-200/70">No associated options are available. Check the Maintenance area.</span>:null}</label> }

function Field({
  name,
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  name: keyof CreateMatchInput;
  label: string;
  value: string;
  onChange: React.Dispatch<React.SetStateAction<CreateMatchInput>>;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <TextInput
        id={name}
        name={name}
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange((current) => ({ ...current, [name]: event.target.value }))}
      />
    </div>
  );
}
