import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const momentTypes = [
  { name: "Organização Ofensiva", code: "OO", color: "#22c55e", defaultShortcut: "1" },
  { name: "Organização Defensiva", code: "OD", color: "#38bdf8", defaultShortcut: "2" },
  { name: "Transição Ofensiva", code: "TO", color: "#f59e0b", defaultShortcut: "3" },
  { name: "Transição Defensiva", code: "TD", color: "#ef4444", defaultShortcut: "4" },
  { name: "Bola Parada Defensiva/Ofensiva", code: "BP", color: "#a78bfa", defaultShortcut: "5" },
];

const subMomentTypes = [
  { name: "Pontapé de Saída", code: "OO_PONTAPE_SAIDA", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Saída do GR", code: "OO_SAIDA_GR", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Construção", code: "OO_CONSTRUCAO", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Criação", code: "OO_CRIACAO", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Corredor Direito", code: "OO_CORREDOR_DIREITO", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Corredor Esquerdo", code: "OO_CORREDOR_ESQUERDO", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Finalização", code: "OO_FINALIZACAO", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Golo", code: "OO_GOLO", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Saída do GR", code: "OD_SAIDA_GR", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Bloco Alto", code: "OD_BLOCO_ALTO", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Bloco Médio", code: "OD_BLOCO_MEDIO", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Bloco Baixo", code: "OD_BLOCO_BAIXO", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Corredor Direito", code: "OD_CORREDOR_DIREITO", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Corredor Esquerdo", code: "OD_CORREDOR_ESQUERDO", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Finalização", code: "OD_FINALIZACAO", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Golo", code: "OD_GOLO", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Recuperação Meio Campo Defensivo", code: "TO_RECUPERACAO_MCD", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Recuperação Meio Campo Ofensivo", code: "TO_RECUPERACAO_MCO", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Finalização", code: "TO_FINALIZACAO", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Golo", code: "TO_GOLO", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Recuperação Meio Campo Defensivo", code: "TD_RECUPERACAO_MCD", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Recuperação Meio Campo Ofensivo", code: "TD_RECUPERACAO_MCO", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Finalização", code: "TD_FINALIZACAO", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Golo", code: "TD_GOLO", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Canto", code: "BP_CANTO", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Lançamento", code: "BP_LANCAMENTO", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Livre", code: "BP_LIVRE", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Penalti", code: "BP_PENALTI", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Finalização", code: "BP_FINALIZACAO", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Golo", code: "BP_GOLO", requiresFieldLocation: false, requiresGoalLocation: false },
];

const playerShortcuts = [
  { actionType: "player.togglePlay", targetType: "player", targetId: null, key: "Space" },
  { actionType: "player.seekBack5", targetType: "player", targetId: null, key: "ArrowLeft" },
  { actionType: "player.seekForward5", targetType: "player", targetId: null, key: "ArrowRight" },
  { actionType: "player.seekBack15", targetType: "player", targetId: null, key: "Shift+ArrowLeft" },
  { actionType: "player.seekForward15", targetType: "player", targetId: null, key: "Shift+ArrowRight" },
  { actionType: "moment.cancelActive", targetType: "moment", targetId: null, key: "Escape" },
  { actionType: "editor.save", targetType: "editor", targetId: null, key: "S" },
];

async function main() {
  const savedMomentTypeIds: Record<string, string> = {};

  for (const type of momentTypes) {
    const savedType = await prisma.momentType.upsert({
      where: { code: type.code },
      update: type,
      create: type,
    });
    savedMomentTypeIds[type.code] = savedType.id;

    await prisma.shortcutSetting.upsert({
      where: { id: `seed-moment-${type.code}` },
      update: {
        actionType: "moment.toggle",
        targetType: "momentType",
        targetId: savedType.id,
        key: type.defaultShortcut,
      },
      create: {
        id: `seed-moment-${type.code}`,
        actionType: "moment.toggle",
        targetType: "momentType",
        targetId: savedType.id,
        key: type.defaultShortcut,
      },
    });
  }

  if (savedMomentTypeIds.BP) {
    const legacyTypes = await prisma.momentType.findMany({
      where: { code: { in: ["BPO", "BPD"] } },
    });

    for (const legacyType of legacyTypes) {
      await prisma.moment.updateMany({
        where: { momentTypeId: legacyType.id },
        data: { momentTypeId: savedMomentTypeIds.BP },
      });
      await prisma.shortcutSetting.deleteMany({
        where: { targetType: "momentType", targetId: legacyType.id },
      });
      await prisma.momentType.delete({ where: { id: legacyType.id } });
    }
  }

  for (const type of subMomentTypes) {
    await prisma.subMomentType.upsert({
      where: { code: type.code },
      update: type,
      create: type,
    });
  }

  const legacySubMomentTypes = await prisma.subMomentType.findMany({
    where: {
      code: {
        in: [
          "OPORTUNIDADE",
          "ESPACO",
          "GOLO",
          "REMATE",
          "DEFESA_GR",
          "A_CORRIGIR",
          "PRESSAO_ALTA",
          "BLOCO_BAIXO",
          "ERRO_POSICIONAL",
        ],
      },
    },
    include: { _count: { select: { subMoments: true } } },
  });

  for (const legacyType of legacySubMomentTypes) {
    if (legacyType._count.subMoments === 0) {
      await prisma.subMomentType.delete({ where: { id: legacyType.id } });
    }
  }

  for (const shortcut of playerShortcuts) {
    await prisma.shortcutSetting.upsert({
      where: { id: `seed-${shortcut.actionType}` },
      update: shortcut,
      create: {
        id: `seed-${shortcut.actionType}`,
        ...shortcut,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
