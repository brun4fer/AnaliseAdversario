import type {
  MomentTypeRecord,
  ShortcutSettingRecord,
  SubMomentTypeRecord,
} from "@/lib/domain";

const timestamp = "2026-01-01T00:00:00.000Z";

export const defaultMomentTypes: MomentTypeRecord[] = [
  { id: "mt-oo", name: "Offensive Organization", code: "OO", color: "#22c55e", defaultShortcut: "1", createdAt: timestamp, updatedAt: timestamp },
  { id: "mt-od", name: "Defensive Organization", code: "DO", color: "#38bdf8", defaultShortcut: "2", createdAt: timestamp, updatedAt: timestamp },
  { id: "mt-to", name: "Offensive Transition", code: "OT", color: "#f59e0b", defaultShortcut: "3", createdAt: timestamp, updatedAt: timestamp },
  { id: "mt-td", name: "Defensive Transition", code: "DT", color: "#ef4444", defaultShortcut: "4", createdAt: timestamp, updatedAt: timestamp },
  { id: "mt-bpo", name: "Offensive Set Pieces", code: "OSP", color: "#ec4899", defaultShortcut: "5", createdAt: timestamp, updatedAt: timestamp },
  { id: "mt-bpd", name: "Defensive Set Pieces", code: "DSP", color: "#a78bfa", defaultShortcut: "6", createdAt: timestamp, updatedAt: timestamp },
];

const defaultSubMomentTypeDefinitions: SubMomentTypeRecord[] = [
  { id: "smt-oo-pontape-saida", name: "Kickoff", code: "OO_KICKOFF", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-oo-saida-gr", name: "Goalkeeper Build-up", code: "OO_GOALKEEPER_BUILDUP", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-oo-construcao", name: "Build-up", code: "OO_BUILDUP", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-oo-criacao", name: "Chance Creation", code: "OO_CHANCE_CREATION", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-oo-corredor-direito", name: "Right Channel", code: "OO_RIGHT_CHANNEL", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-oo-corredor-esquerdo", name: "Left Channel", code: "OO_LEFT_CHANNEL", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-oo-finalizacao", name: "Finishing", code: "OO_FINISHING", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-oo-golo", name: "Goal", code: "OO_GOAL", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-od-saida-gr", name: "Goalkeeper Build-up", code: "DO_GOALKEEPER_BUILDUP", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-od-bloco-alto", name: "High Block", code: "DO_HIGH_BLOCK", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-od-bloco-medio", name: "Mid Block", code: "DO_MID_BLOCK", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-od-bloco-baixo", name: "Low Block", code: "DO_LOW_BLOCK", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-od-corredor-direito", name: "Right Channel", code: "DO_RIGHT_CHANNEL", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-od-corredor-esquerdo", name: "Left Channel", code: "DO_LEFT_CHANNEL", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-od-finalizacao", name: "Finishing", code: "DO_FINISHING", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-od-golo", name: "Goal", code: "DO_GOAL", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-to-recuperacao-mcd", name: "Defensive Half Recovery", code: "OT_DEFENSIVE_HALF_RECOVERY", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-to-recuperacao-mco", name: "Attacking Half Recovery", code: "OT_ATTACKING_HALF_RECOVERY", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-to-finalizacao", name: "Finishing", code: "OT_FINISHING", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-to-golo", name: "Goal", code: "OT_GOAL", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-td-recuperacao-mcd", name: "Defensive Half Recovery", code: "DT_DEFENSIVE_HALF_RECOVERY", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-td-recuperacao-mco", name: "Attacking Half Recovery", code: "DT_ATTACKING_HALF_RECOVERY", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-td-finalizacao", name: "Finishing", code: "DT_FINISHING", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-td-golo", name: "Goal", code: "DT_GOAL", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-bp-canto", name: "Corner", code: "SP_CORNER", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-bp-lancamento", name: "Throw-in", code: "SP_THROW_IN", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-bp-livre", name: "Free Kick", code: "SP_FREE_KICK", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-bp-penalti", name: "Penalty", code: "SP_PENALTY", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-bp-finalizacao", name: "Finishing", code: "SP_FINISHING", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-bp-golo", name: "Goal", code: "SP_GOAL", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
];

export const defaultSubMomentTypes: SubMomentTypeRecord[] = defaultSubMomentTypeDefinitions;

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
