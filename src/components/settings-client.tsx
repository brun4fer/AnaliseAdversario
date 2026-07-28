"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";

import { Button, FieldLabel, Panel, TextInput } from "@/components/ui";
import type { MomentTypeRecord, SettingsPayload, ShortcutSettingRecord, SubMomentTypeRecord } from "@/lib/domain";
import { apiFetch } from "@/lib/http";
import { normalizeShortcutFromEvent } from "@/lib/keyboard";

export function SettingsClient() {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<SettingsPayload>("/api/settings")
      .then(setSettings)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timeout = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function refreshSettings() {
    setSettings(await apiFetch<SettingsPayload>("/api/settings"));
  }

  async function updateShortcut(shortcut: ShortcutSettingRecord, key: string) {
    const saved = await apiFetch<ShortcutSettingRecord>(`/api/settings/shortcuts/${shortcut.id}`, {
      method: "PATCH",
      body: JSON.stringify({ key }),
    });
    setSettings((current) =>
      current
        ? {
            ...current,
            shortcuts: current.shortcuts.map((item) => (item.id === saved.id ? saved : item)),
          }
        : current,
    );
    setNotice("Shortcut saved.");
  }

  if (loading) {
    return <div className="h-[70vh] animate-pulse rounded-lg border border-white/10 bg-white/[0.04]" />;
  }

  if (error || !settings) {
    return <Panel className="border-red-400/30 p-5 text-red-100">{error ?? "Could not open settings."}</Panel>;
  }

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-white/10 bg-white/[0.045] p-5 shadow-panel">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-200/80">Configuration</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Analysis settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Adjust shortcuts, main types and submoments. These settings can grow without changing the local video workflow.
        </p>
      </header>

      <div className="grid gap-5 xl:grid-cols-[24rem_1fr]">
        <ShortcutPanel settings={settings} onChange={updateShortcut} />
        <div className="space-y-5">
          <MomentTypesPanel settings={settings} onRefresh={refreshSettings} onNotice={setNotice} />
          <SubMomentTypesPanel settings={settings} onRefresh={refreshSettings} onNotice={setNotice} />
        </div>
      </div>

      {notice ? (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md border border-cyan-300/25 bg-pitch-900 px-4 py-2 text-sm text-cyan-100 shadow-glow">
          {notice}
        </div>
      ) : null}
    </div>
  );
}

function ShortcutPanel({
  settings,
  onChange,
}: {
  settings: SettingsPayload;
  onChange: (shortcut: ShortcutSettingRecord, key: string) => Promise<void>;
}) {
  const shortcutRows = useMemo(
    () =>
      settings.shortcuts.map((shortcut) => ({
        shortcut,
        label: getShortcutLabel(shortcut, settings.momentTypes),
      })),
    [settings],
  );

  return (
    <Panel className="p-4">
      <h2 className="font-semibold text-white">Shortcuts</h2>
      <p className="mt-1 text-sm text-slate-500">Click a shortcut and press the new key.</p>
      <div className="mt-4 space-y-2">
        {shortcutRows.map(({ shortcut, label }) => (
          <div key={shortcut.id} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-white/10 bg-white/[0.035] p-2">
            <span className="min-w-0 truncate text-sm text-slate-300">{label}</span>
            <ShortcutCapture shortcut={shortcut} onChange={onChange} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ShortcutCapture({
  shortcut,
  onChange,
}: {
  shortcut: ShortcutSettingRecord;
  onChange: (shortcut: ShortcutSettingRecord, key: string) => Promise<void>;
}) {
  const [capturing, setCapturing] = useState(false);

  return (
    <button
      type="button"
      className="min-w-24 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-xs font-medium text-cyan-100 outline-none transition focus:ring-2 focus:ring-cyan-300/40"
      onClick={() => setCapturing(true)}
      onBlur={() => setCapturing(false)}
      onKeyDown={(event) => {
        if (!capturing) {
          return;
        }
        event.preventDefault();
        const key = normalizeShortcutFromEvent(event.nativeEvent);
        if (key) {
          setCapturing(false);
          void onChange(shortcut, key);
        }
      }}
    >
      {capturing ? "Press..." : shortcut.key}
    </button>
  );
}

function MomentTypesPanel({
  settings,
  onRefresh,
  onNotice,
}: {
  settings: SettingsPayload;
  onRefresh: () => Promise<void>;
  onNotice: (message: string) => void;
}) {
  const [drafts, setDrafts] = useState(settings.momentTypes);
  const [newType, setNewType] = useState({ name: "", code: "", color: "#22d3ee", defaultShortcut: "" });

  useEffect(() => setDrafts(settings.momentTypes), [settings.momentTypes]);

  async function saveType(type: MomentTypeRecord) {
    await apiFetch<MomentTypeRecord>(`/api/settings/moment-types/${type.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: type.name,
        code: type.code,
        color: type.color,
        defaultShortcut: type.defaultShortcut,
      }),
    });
    await onRefresh();
    onNotice("Moment type saved.");
  }

  async function createType() {
    await apiFetch<MomentTypeRecord>("/api/settings/moment-types", {
      method: "POST",
      body: JSON.stringify(newType),
    });
    setNewType({ name: "", code: "", color: "#22d3ee", defaultShortcut: "" });
    await onRefresh();
    onNotice("Moment type created.");
  }

  async function deleteType(type: MomentTypeRecord) {
    if (!window.confirm(`Delete type ${type.code}?`)) {
      return;
    }
    await apiFetch<void>(`/api/settings/moment-types/${type.id}`, { method: "DELETE" });
    await onRefresh();
    onNotice("Moment type deleted.");
  }

  return (
    <Panel className="p-4">
      <h2 className="font-semibold text-white">Moments</h2>
      <div className="mt-4 space-y-3">
        {drafts.map((type) => (
          <div key={type.id} className="grid gap-2 rounded-md border border-white/10 bg-white/[0.035] p-3 lg:grid-cols-[1.2fr_0.55fr_0.55fr_0.65fr_auto]">
            <TextInput value={type.name} onChange={(event) => setDrafts((current) => current.map((item) => (item.id === type.id ? { ...item, name: event.target.value } : item)))} />
            <TextInput value={type.code} onChange={(event) => setDrafts((current) => current.map((item) => (item.id === type.id ? { ...item, code: event.target.value } : item)))} />
            <TextInput type="color" value={type.color} onChange={(event) => setDrafts((current) => current.map((item) => (item.id === type.id ? { ...item, color: event.target.value } : item)))} />
            <TextInput value={type.defaultShortcut} onChange={(event) => setDrafts((current) => current.map((item) => (item.id === type.id ? { ...item, defaultShortcut: event.target.value.toUpperCase() } : item)))} />
            <div className="flex gap-2">
              <Button size="icon" variant="secondary" aria-label="Save type" onClick={() => void saveType(type)}>
                <Save size={15} />
              </Button>
              <Button size="icon" variant="danger" aria-label="Delete type" onClick={() => void deleteType(type)}>
                <Trash2 size={15} />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-md border border-cyan-300/20 bg-cyan-300/[0.05] p-3">
        <FieldLabel>New type</FieldLabel>
        <div className="mt-2 grid gap-2 lg:grid-cols-[1.2fr_0.55fr_0.55fr_0.65fr_auto]">
          <TextInput placeholder="Name" value={newType.name} onChange={(event) => setNewType((current) => ({ ...current, name: event.target.value }))} />
          <TextInput placeholder="Code" value={newType.code} onChange={(event) => setNewType((current) => ({ ...current, code: event.target.value }))} />
          <TextInput type="color" value={newType.color} onChange={(event) => setNewType((current) => ({ ...current, color: event.target.value }))} />
          <TextInput placeholder="Shortcut" value={newType.defaultShortcut} onChange={(event) => setNewType((current) => ({ ...current, defaultShortcut: event.target.value.toUpperCase() }))} />
          <Button variant="primary" onClick={() => void createType()} disabled={!newType.name || !newType.code || !newType.defaultShortcut}>
            <Plus size={15} />
            Create
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function SubMomentTypesPanel({
  settings,
  onRefresh,
  onNotice,
}: {
  settings: SettingsPayload;
  onRefresh: () => Promise<void>;
  onNotice: (message: string) => void;
}) {
  const [drafts, setDrafts] = useState(settings.subMomentTypes);
  const [newType, setNewType] = useState({
    name: "",
    code: "",
    requiresFieldLocation: false,
    requiresGoalLocation: false,
  });

  useEffect(() => setDrafts(settings.subMomentTypes), [settings.subMomentTypes]);

  async function saveType(type: SubMomentTypeRecord) {
    await apiFetch<SubMomentTypeRecord>(`/api/settings/submoment-types/${type.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: type.name,
        code: type.code,
        requiresFieldLocation: type.requiresFieldLocation,
        requiresGoalLocation: type.requiresGoalLocation,
      }),
    });
    await onRefresh();
    onNotice("Submoment type saved.");
  }

  async function createType() {
    await apiFetch<SubMomentTypeRecord>("/api/settings/submoment-types", {
      method: "POST",
      body: JSON.stringify(newType),
    });
    setNewType({ name: "", code: "", requiresFieldLocation: false, requiresGoalLocation: false });
    await onRefresh();
    onNotice("Submoment type created.");
  }

  async function deleteType(type: SubMomentTypeRecord) {
    if (!window.confirm(`Delete submoment ${type.name}?`)) {
      return;
    }
    await apiFetch<void>(`/api/settings/submoment-types/${type.id}`, { method: "DELETE" });
    await onRefresh();
    onNotice("Submoment type deleted.");
  }

  return (
    <Panel className="p-4">
      <h2 className="font-semibold text-white">Submoments</h2>
      <div className="mt-4 space-y-3">
        {drafts.map((type) => (
          <div key={type.id} className="grid gap-2 rounded-md border border-white/10 bg-white/[0.035] p-3 lg:grid-cols-[1.2fr_0.7fr_auto]">
            <TextInput value={type.name} onChange={(event) => setDrafts((current) => current.map((item) => (item.id === type.id ? { ...item, name: event.target.value } : item)))} />
            <TextInput value={type.code} onChange={(event) => setDrafts((current) => current.map((item) => (item.id === type.id ? { ...item, code: event.target.value } : item)))} />
            <div className="flex gap-2">
              <Button size="icon" variant="secondary" aria-label="Save submoment" onClick={() => void saveType(type)}>
                <Save size={15} />
              </Button>
              <Button size="icon" variant="danger" aria-label="Delete submoment" onClick={() => void deleteType(type)}>
                <Trash2 size={15} />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-md border border-cyan-300/20 bg-cyan-300/[0.05] p-3">
        <FieldLabel>New submoment</FieldLabel>
        <div className="mt-2 grid gap-2 lg:grid-cols-[1.2fr_0.7fr_auto]">
          <TextInput placeholder="Name" value={newType.name} onChange={(event) => setNewType((current) => ({ ...current, name: event.target.value }))} />
          <TextInput placeholder="Code" value={newType.code} onChange={(event) => setNewType((current) => ({ ...current, code: event.target.value }))} />
          <Button variant="primary" onClick={() => void createType()} disabled={!newType.name || !newType.code}>
            <Plus size={15} />
            Create
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function getShortcutLabel(shortcut: ShortcutSettingRecord, momentTypes: MomentTypeRecord[]) {
  if (shortcut.actionType === "moment.toggle" && shortcut.targetId) {
    const type = momentTypes.find((item) => item.id === shortcut.targetId);
    return type ? `${type.code} - ${type.name}` : "Moment";
  }

  const labels: Record<string, string> = {
    "player.togglePlay": "Play/Pause",
    "player.seekBack5": "Back 5 seconds",
    "player.seekForward5": "Forward 5 seconds",
    "player.seekBack15": "Back 15 seconds",
    "player.seekForward15": "Forward 15 seconds",
    "moment.cancelActive": "Cancel active tag",
    "editor.save": "Save edit",
  };

  return labels[shortcut.actionType] ?? shortcut.actionType;
}
