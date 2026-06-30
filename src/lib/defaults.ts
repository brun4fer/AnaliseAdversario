import type {
  MomentTypeRecord,
  ShortcutSettingRecord,
  SubMomentTypeRecord,
} from "@/lib/domain";

const timestamp = "2026-01-01T00:00:00.000Z";

export const defaultMomentTypes: MomentTypeRecord[] = [
  { id: "mt-oo", name: "Organização Ofensiva", code: "OO", color: "#22c55e", defaultShortcut: "1", createdAt: timestamp, updatedAt: timestamp },
  { id: "mt-od", name: "Organização Defensiva", code: "OD", color: "#38bdf8", defaultShortcut: "2", createdAt: timestamp, updatedAt: timestamp },
  { id: "mt-to", name: "Transição Ofensiva", code: "TO", color: "#f59e0b", defaultShortcut: "3", createdAt: timestamp, updatedAt: timestamp },
  { id: "mt-td", name: "Transição Defensiva", code: "TD", color: "#ef4444", defaultShortcut: "4", createdAt: timestamp, updatedAt: timestamp },
  { id: "mt-bpo", name: "Bola Parada Ofensiva", code: "BPO", color: "#a78bfa", defaultShortcut: "5", createdAt: timestamp, updatedAt: timestamp },
  { id: "mt-bpd", name: "Bola Parada Defensiva", code: "BPD", color: "#14b8a6", defaultShortcut: "6", createdAt: timestamp, updatedAt: timestamp },
];

export const defaultSubMomentTypes: SubMomentTypeRecord[] = [
  { id: "smt-oportunidade", name: "Oportunidade", code: "OPORTUNIDADE", requiresFieldLocation: true, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-espaco", name: "Espaço", code: "ESPACO", requiresFieldLocation: true, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-golo", name: "Golo", code: "GOLO", requiresFieldLocation: true, requiresGoalLocation: true, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-remate", name: "Remate", code: "REMATE", requiresFieldLocation: true, requiresGoalLocation: true, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-defesa-gr", name: "Defesa do Guarda-Redes", code: "DEFESA_GR", requiresFieldLocation: true, requiresGoalLocation: true, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-a-corrigir", name: "A Corrigir", code: "A_CORRIGIR", requiresFieldLocation: true, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-pressao-alta", name: "Pressão Alta", code: "PRESSAO_ALTA", requiresFieldLocation: true, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-bloco-baixo", name: "Bloco Baixo", code: "BLOCO_BAIXO", requiresFieldLocation: true, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-erro-posicional", name: "Erro Posicional", code: "ERRO_POSICIONAL", requiresFieldLocation: true, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
];

export const defaultPlayerShortcuts: ShortcutSettingRecord[] = [
  { id: "sc-play", actionType: "player.togglePlay", targetType: "player", targetId: null, key: "Space", createdAt: timestamp, updatedAt: timestamp },
  { id: "sc-back-5", actionType: "player.seekBack5", targetType: "player", targetId: null, key: "ArrowLeft", createdAt: timestamp, updatedAt: timestamp },
  { id: "sc-forward-5", actionType: "player.seekForward5", targetType: "player", targetId: null, key: "ArrowRight", createdAt: timestamp, updatedAt: timestamp },
  { id: "sc-back-15", actionType: "player.seekBack15", targetType: "player", targetId: null, key: "Shift+ArrowLeft", createdAt: timestamp, updatedAt: timestamp },
  { id: "sc-forward-15", actionType: "player.seekForward15", targetType: "player", targetId: null, key: "Shift+ArrowRight", createdAt: timestamp, updatedAt: timestamp },
  { id: "sc-cancel", actionType: "moment.cancelActive", targetType: "moment", targetId: null, key: "Escape", createdAt: timestamp, updatedAt: timestamp },
  { id: "sc-save", actionType: "editor.save", targetType: "editor", targetId: null, key: "S", createdAt: timestamp, updatedAt: timestamp },
];

export function buildDefaultShortcuts(momentTypes = defaultMomentTypes): ShortcutSettingRecord[] {
  const momentShortcuts = momentTypes.map((type) => ({
    id: `sc-${type.id}`,
    actionType: "moment.toggle",
    targetType: "momentType",
    targetId: type.id,
    key: type.defaultShortcut,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  return [...momentShortcuts, ...defaultPlayerShortcuts];
}
