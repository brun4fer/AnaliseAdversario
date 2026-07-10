import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function requiresGoalLocation(code: string) {
  return code.endsWith("_FINISHING") || code.endsWith("_GOAL") || code.endsWith("_PENALTY");
}

const momentTypes = [
  { name: "Offensive Organization", code: "OO", color: "#22c55e", defaultShortcut: "1" },
  { name: "Defensive Organization", code: "DO", color: "#38bdf8", defaultShortcut: "2" },
  { name: "Offensive Transition", code: "OT", color: "#f59e0b", defaultShortcut: "3" },
  { name: "Defensive Transition", code: "DT", color: "#ef4444", defaultShortcut: "4" },
  { name: "Defensive Set Pieces", code: "DSP", color: "#a78bfa", defaultShortcut: "5" },
  { name: "Offensive Set Pieces", code: "OSP", color: "#ec4899", defaultShortcut: "6" },
];

const legacyMomentTypeCodeMappings = [
  { from: "OD", to: "DO" },
  { from: "TO", to: "OT" },
  { from: "TD", to: "DT" },
  { from: "BPD", to: "DSP" },
  { from: "BPO", to: "OSP" },
  { from: "BP", to: "OSP" },
] as const;

const subMomentTypeDefinitions = [
  { name: "Kickoff", code: "OO_KICKOFF", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Goalkeeper Build-up", code: "OO_GOALKEEPER_BUILDUP", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Build-up", code: "OO_BUILDUP", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Chance Creation", code: "OO_CHANCE_CREATION", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Right Channel", code: "OO_RIGHT_CHANNEL", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Left Channel", code: "OO_LEFT_CHANNEL", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Finishing", code: "OO_FINISHING", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Goal", code: "OO_GOAL", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Goalkeeper Build-up", code: "DO_GOALKEEPER_BUILDUP", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "High Block", code: "DO_HIGH_BLOCK", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Mid Block", code: "DO_MID_BLOCK", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Low Block", code: "DO_LOW_BLOCK", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Right Channel", code: "DO_RIGHT_CHANNEL", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Left Channel", code: "DO_LEFT_CHANNEL", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Finishing", code: "DO_FINISHING", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Goal", code: "DO_GOAL", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Defensive Half Recovery", code: "OT_DEFENSIVE_HALF_RECOVERY", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Attacking Half Recovery", code: "OT_ATTACKING_HALF_RECOVERY", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Finishing", code: "OT_FINISHING", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Goal", code: "OT_GOAL", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Defensive Half Recovery", code: "DT_DEFENSIVE_HALF_RECOVERY", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Attacking Half Recovery", code: "DT_ATTACKING_HALF_RECOVERY", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Finishing", code: "DT_FINISHING", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Goal", code: "DT_GOAL", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Corner", code: "SP_CORNER", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Throw-in", code: "SP_THROW_IN", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Free Kick", code: "SP_FREE_KICK", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Penalty", code: "SP_PENALTY", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Finishing", code: "SP_FINISHING", requiresFieldLocation: false, requiresGoalLocation: false },
  { name: "Goal", code: "SP_GOAL", requiresFieldLocation: false, requiresGoalLocation: false },
];

const legacySubMomentTypeCodeMappings = [
  { from: "OO_PONTAPE_SAIDA", to: "OO_KICKOFF" },
  { from: "OO_SAIDA_GR", to: "OO_GOALKEEPER_BUILDUP" },
  { from: "OO_CONSTRUCAO", to: "OO_BUILDUP" },
  { from: "OO_CRIACAO", to: "OO_CHANCE_CREATION" },
  { from: "OO_CORREDOR_DIREITO", to: "OO_RIGHT_CHANNEL" },
  { from: "OO_CORREDOR_ESQUERDO", to: "OO_LEFT_CHANNEL" },
  { from: "OO_FINALIZACAO", to: "OO_FINISHING" },
  { from: "OO_GOLO", to: "OO_GOAL" },
  { from: "OD_SAIDA_GR", to: "DO_GOALKEEPER_BUILDUP" },
  { from: "OD_BLOCO_ALTO", to: "DO_HIGH_BLOCK" },
  { from: "OD_BLOCO_MEDIO", to: "DO_MID_BLOCK" },
  { from: "OD_BLOCO_BAIXO", to: "DO_LOW_BLOCK" },
  { from: "OD_CORREDOR_DIREITO", to: "DO_RIGHT_CHANNEL" },
  { from: "OD_CORREDOR_ESQUERDO", to: "DO_LEFT_CHANNEL" },
  { from: "OD_FINALIZACAO", to: "DO_FINISHING" },
  { from: "OD_GOLO", to: "DO_GOAL" },
  { from: "TO_RECUPERACAO_MCD", to: "OT_DEFENSIVE_HALF_RECOVERY" },
  { from: "TO_RECUPERACAO_MCO", to: "OT_ATTACKING_HALF_RECOVERY" },
  { from: "TO_FINALIZACAO", to: "OT_FINISHING" },
  { from: "TO_GOLO", to: "OT_GOAL" },
  { from: "TD_RECUPERACAO_MCD", to: "DT_DEFENSIVE_HALF_RECOVERY" },
  { from: "TD_RECUPERACAO_MCO", to: "DT_ATTACKING_HALF_RECOVERY" },
  { from: "TD_FINALIZACAO", to: "DT_FINISHING" },
  { from: "TD_GOLO", to: "DT_GOAL" },
  { from: "BP_CANTO", to: "SP_CORNER" },
  { from: "BP_LANCAMENTO", to: "SP_THROW_IN" },
  { from: "BP_LIVRE", to: "SP_FREE_KICK" },
  { from: "BP_PENALTI", to: "SP_PENALTY" },
  { from: "BP_FINALIZACAO", to: "SP_FINISHING" },
  { from: "BP_GOLO", to: "SP_GOAL" },
] as const;

const subMomentTypes = subMomentTypeDefinitions.map((type) => ({
  ...type,
  requiresFieldLocation: true,
  requiresGoalLocation: requiresGoalLocation(type.code),
}));

const playerShortcuts = [
  { actionType: "player.togglePlay", targetType: "player", targetId: null, key: "Space" },
  { actionType: "player.seekBack5", targetType: "player", targetId: null, key: "ArrowLeft" },
  { actionType: "player.seekForward5", targetType: "player", targetId: null, key: "ArrowRight" },
  { actionType: "player.seekBack15", targetType: "player", targetId: null, key: "Shift+ArrowLeft" },
  { actionType: "player.seekForward15", targetType: "player", targetId: null, key: "Shift+ArrowRight" },
  { actionType: "moment.cancelActive", targetType: "moment", targetId: null, key: "Escape" },
  { actionType: "editor.save", targetType: "editor", targetId: null, key: "S" },
];

async function migrateLegacyMomentTypeCodes() {
  for (const mapping of legacyMomentTypeCodeMappings) {
    const [targetType, legacyTypes] = await Promise.all([
      prisma.momentType.findUnique({ where: { code: mapping.to } }),
      prisma.momentType.findMany({ where: { code: mapping.from } }),
    ]);

    for (const legacyType of legacyTypes) {
      if (targetType && targetType.id !== legacyType.id) {
        await prisma.moment.updateMany({
          where: { momentTypeId: legacyType.id },
          data: { momentTypeId: targetType.id },
        });
        await prisma.shortcutSetting.deleteMany({
          where: { targetType: "momentType", targetId: legacyType.id },
        });
        await prisma.momentType.delete({ where: { id: legacyType.id } });
        continue;
      }

      await prisma.momentType.update({
        where: { id: legacyType.id },
        data: { code: mapping.to },
      });
    }
  }
}

async function migrateLegacySubMomentTypeCodes() {
  for (const mapping of legacySubMomentTypeCodeMappings) {
    const [targetType, legacyTypes] = await Promise.all([
      prisma.subMomentType.findUnique({ where: { code: mapping.to } }),
      prisma.subMomentType.findMany({ where: { code: mapping.from } }),
    ]);

    for (const legacyType of legacyTypes) {
      if (targetType && targetType.id !== legacyType.id) {
        await prisma.subMoment.updateMany({
          where: { subMomentTypeId: legacyType.id },
          data: { subMomentTypeId: targetType.id },
        });
        await prisma.subMomentType.delete({ where: { id: legacyType.id } });
        continue;
      }

      await prisma.subMomentType.update({
        where: { id: legacyType.id },
        data: { code: mapping.to },
      });
    }
  }
}

async function main() {
  await migrateLegacyMomentTypeCodes();
  await migrateLegacySubMomentTypeCodes();

  for (const type of momentTypes) {
    const savedType = await prisma.momentType.upsert({
      where: { code: type.code },
      update: type,
      create: type,
    });

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
