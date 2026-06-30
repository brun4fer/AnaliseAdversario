import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const momentTypes = [
  { name: "Organização Ofensiva", code: "OO", color: "#22c55e", defaultShortcut: "1" },
  { name: "Organização Defensiva", code: "OD", color: "#38bdf8", defaultShortcut: "2" },
  { name: "Transição Ofensiva", code: "TO", color: "#f59e0b", defaultShortcut: "3" },
  { name: "Transição Defensiva", code: "TD", color: "#ef4444", defaultShortcut: "4" },
  { name: "Bola Parada Ofensiva", code: "BPO", color: "#a78bfa", defaultShortcut: "5" },
  { name: "Bola Parada Defensiva", code: "BPD", color: "#14b8a6", defaultShortcut: "6" },
];

const subMomentTypes = [
  { name: "Oportunidade", code: "OPORTUNIDADE", requiresFieldLocation: true, requiresGoalLocation: false },
  { name: "Espaço", code: "ESPACO", requiresFieldLocation: true, requiresGoalLocation: false },
  { name: "Golo", code: "GOLO", requiresFieldLocation: true, requiresGoalLocation: true },
  { name: "Remate", code: "REMATE", requiresFieldLocation: true, requiresGoalLocation: true },
  { name: "Defesa do Guarda-Redes", code: "DEFESA_GR", requiresFieldLocation: true, requiresGoalLocation: true },
  { name: "A Corrigir", code: "A_CORRIGIR", requiresFieldLocation: true, requiresGoalLocation: false },
  { name: "Pressão Alta", code: "PRESSAO_ALTA", requiresFieldLocation: true, requiresGoalLocation: false },
  { name: "Bloco Baixo", code: "BLOCO_BAIXO", requiresFieldLocation: true, requiresGoalLocation: false },
  { name: "Erro Posicional", code: "ERRO_POSICIONAL", requiresFieldLocation: true, requiresGoalLocation: false },
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
