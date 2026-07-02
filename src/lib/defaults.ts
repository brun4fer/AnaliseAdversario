import type {
  MomentTypeRecord,
  ShortcutSettingRecord,
  SubMomentTypeRecord,
} from "@/lib/domain";

const timestamp = "2026-01-01T00:00:00.000Z";

function requiresGoalLocation(code: string) {
  return code.endsWith("_FINALIZACAO") || code.endsWith("_GOLO") || code.endsWith("_PENALTI");
}

export const defaultMomentTypes: MomentTypeRecord[] = [
  { id: "mt-oo", name: "Organização Ofensiva", code: "OO", color: "#22c55e", defaultShortcut: "1", createdAt: timestamp, updatedAt: timestamp },
  { id: "mt-od", name: "Organização Defensiva", code: "OD", color: "#38bdf8", defaultShortcut: "2", createdAt: timestamp, updatedAt: timestamp },
  { id: "mt-to", name: "Transição Ofensiva", code: "TO", color: "#f59e0b", defaultShortcut: "3", createdAt: timestamp, updatedAt: timestamp },
  { id: "mt-td", name: "Transição Defensiva", code: "TD", color: "#ef4444", defaultShortcut: "4", createdAt: timestamp, updatedAt: timestamp },
  { id: "mt-bp", name: "Bola Parada Defensiva/Ofensiva", code: "BP", color: "#a78bfa", defaultShortcut: "5", createdAt: timestamp, updatedAt: timestamp },
];

const defaultSubMomentTypeDefinitions: SubMomentTypeRecord[] = [
  { id: "smt-oo-pontape-saida", name: "Pontapé de Saída", code: "OO_PONTAPE_SAIDA", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-oo-saida-gr", name: "Saída do GR", code: "OO_SAIDA_GR", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-oo-construcao", name: "Construção", code: "OO_CONSTRUCAO", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-oo-criacao", name: "Criação", code: "OO_CRIACAO", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-oo-corredor-direito", name: "Corredor Direito", code: "OO_CORREDOR_DIREITO", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-oo-corredor-esquerdo", name: "Corredor Esquerdo", code: "OO_CORREDOR_ESQUERDO", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-oo-finalizacao", name: "Finalização", code: "OO_FINALIZACAO", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-oo-golo", name: "Golo", code: "OO_GOLO", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-od-saida-gr", name: "Saída do GR", code: "OD_SAIDA_GR", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-od-bloco-alto", name: "Bloco Alto", code: "OD_BLOCO_ALTO", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-od-bloco-medio", name: "Bloco Médio", code: "OD_BLOCO_MEDIO", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-od-bloco-baixo", name: "Bloco Baixo", code: "OD_BLOCO_BAIXO", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-od-corredor-direito", name: "Corredor Direito", code: "OD_CORREDOR_DIREITO", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-od-corredor-esquerdo", name: "Corredor Esquerdo", code: "OD_CORREDOR_ESQUERDO", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-od-finalizacao", name: "Finalização", code: "OD_FINALIZACAO", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-od-golo", name: "Golo", code: "OD_GOLO", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-to-recuperacao-mcd", name: "Recuperação Meio Campo Defensivo", code: "TO_RECUPERACAO_MCD", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-to-recuperacao-mco", name: "Recuperação Meio Campo Ofensivo", code: "TO_RECUPERACAO_MCO", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-to-finalizacao", name: "Finalização", code: "TO_FINALIZACAO", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-to-golo", name: "Golo", code: "TO_GOLO", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-td-recuperacao-mcd", name: "Recuperação Meio Campo Defensivo", code: "TD_RECUPERACAO_MCD", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-td-recuperacao-mco", name: "Recuperação Meio Campo Ofensivo", code: "TD_RECUPERACAO_MCO", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-td-finalizacao", name: "Finalização", code: "TD_FINALIZACAO", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-td-golo", name: "Golo", code: "TD_GOLO", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-bp-canto", name: "Canto", code: "BP_CANTO", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-bp-lancamento", name: "Lançamento", code: "BP_LANCAMENTO", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-bp-livre", name: "Livre", code: "BP_LIVRE", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-bp-penalti", name: "Penalti", code: "BP_PENALTI", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-bp-finalizacao", name: "Finalização", code: "BP_FINALIZACAO", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
  { id: "smt-bp-golo", name: "Golo", code: "BP_GOLO", requiresFieldLocation: false, requiresGoalLocation: false, createdAt: timestamp, updatedAt: timestamp },
];

export const defaultSubMomentTypes: SubMomentTypeRecord[] = defaultSubMomentTypeDefinitions.map((type) => ({
  ...type,
  requiresFieldLocation: true,
  requiresGoalLocation: requiresGoalLocation(type.code),
}));

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
