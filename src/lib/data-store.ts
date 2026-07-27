import { randomUUID } from "node:crypto";
import type {
  Match,
  MomentType,
  Prisma,
  ShortcutSetting,
  SubMomentType,
  Video,
} from "@prisma/client";

import {
  buildDefaultShortcuts,
  defaultMomentTypes,
  defaultSubMomentTypes,
} from "@/lib/defaults";
import type {
  CreateMatchInput,
  CreateMomentInput,
  CreateSubMomentInput,
  MatchDetail,
  MatchRecord,
  MatchSummary,
  MomentRecord,
  MomentTypeRecord,
  SettingsPayload,
  ShortcutSettingRecord,
  SubMomentRecord,
  SubMomentTypeRecord,
  UpdateMatchInput,
  UpdateMomentInput,
  UpdateSubMomentInput,
  VideoMetadataInput,
  VideoRecord,
} from "@/lib/domain";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";

type MemoryMoment = Omit<MomentRecord, "momentType" | "subMoments">;
type MemorySubMoment = Omit<SubMomentRecord, "subMomentType">;

type MemoryStore = {
  matches: MatchRecord[];
  videos: VideoRecord[];
  momentTypes: MomentTypeRecord[];
  moments: MemoryMoment[];
  subMomentTypes: SubMomentTypeRecord[];
  subMoments: MemorySubMoment[];
  shortcuts: ShortcutSettingRecord[];
};

type PrismaMomentWithRelations = Prisma.MomentGetPayload<{
  include: {
    momentType: true;
    subMoments: {
      include: {
        subMomentType: true;
      };
    };
  };
}>;

type PrismaSubMomentWithType = Prisma.SubMomentGetPayload<{
  include: {
    subMomentType: true;
  };
}>;

const globalForStore = globalThis as unknown as {
  memoryStore?: MemoryStore;
  databaseDefaultsReady?: boolean;
  databaseDefaultsVersion?: string;
};

const databaseDefaultsVersion = "2026-07-english-defaults";

const legacyMomentTypeCodeMappings = [
  { from: "OD", to: "DO" },
  { from: "TO", to: "OT" },
  { from: "TD", to: "DT" },
  { from: "BPD", to: "DSP" },
  { from: "BPO", to: "OSP" },
  { from: "BP", to: "OSP" },
] as const;

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

function now() {
  return new Date().toISOString();
}

function id() {
  return randomUUID();
}

function getMemoryStore() {
  if (!globalForStore.memoryStore) {
    globalForStore.memoryStore = {
      matches: [],
      videos: [],
      momentTypes: defaultMomentTypes.map((type) => ({ ...type })),
      moments: [],
      subMomentTypes: defaultSubMomentTypes.map((type) => ({ ...type })),
      subMoments: [],
      shortcuts: buildDefaultShortcuts(defaultMomentTypes).map((shortcut) => ({ ...shortcut })),
    };
  }

  return globalForStore.memoryStore;
}

function shouldUseDatabase() {
  return hasDatabaseUrl();
}

async function ensureDatabaseDefaults() {
  if (
    !shouldUseDatabase() ||
    (globalForStore.databaseDefaultsReady && globalForStore.databaseDefaultsVersion === databaseDefaultsVersion)
  ) {
    return;
  }

  await migrateLegacyMomentTypeCodes();
  await migrateLegacySubMomentTypeCodes();

  const savedMomentTypes: MomentTypeRecord[] = [];

  for (const type of defaultMomentTypes) {
    const saved = await prisma.momentType.upsert({
      where: { code: type.code },
      update: {
        name: type.name,
        color: type.color,
        defaultShortcut: type.defaultShortcut,
      },
      create: {
        id: type.id,
        name: type.name,
        code: type.code,
        color: type.color,
        defaultShortcut: type.defaultShortcut,
      },
    });
    savedMomentTypes.push(mapMomentType(saved));
  }

  for (const type of defaultSubMomentTypes) {
    await prisma.subMomentType.upsert({
      where: { code: type.code },
      update: {
        name: type.name,
        requiresFieldLocation: type.requiresFieldLocation,
        requiresGoalLocation: type.requiresGoalLocation,
      },
      create: {
        id: type.id,
        name: type.name,
        code: type.code,
        requiresFieldLocation: type.requiresFieldLocation,
        requiresGoalLocation: type.requiresGoalLocation,
      },
    });
  }

  await deleteUnusedLegacySubMomentTypes();

  for (const shortcut of buildDefaultShortcuts(savedMomentTypes)) {
    await prisma.shortcutSetting.upsert({
      where: { id: shortcut.id },
      update: {
        actionType: shortcut.actionType,
        targetType: shortcut.targetType,
        targetId: shortcut.targetId,
        key: shortcut.key,
      },
      create: {
        id: shortcut.id,
        actionType: shortcut.actionType,
        targetType: shortcut.targetType,
        targetId: shortcut.targetId,
        key: shortcut.key,
      },
    });
  }

  globalForStore.databaseDefaultsReady = true;
  globalForStore.databaseDefaultsVersion = databaseDefaultsVersion;
}

function mapMatch(match: Match): MatchRecord {
  return {
    id: match.id,
    title: match.title,
    teamName: match.teamName,
    opponentName: match.opponentName,
    matchDate: match.matchDate?.toISOString() ?? null,
    competition: match.competition,
    venue: match.venue,
    notes: match.notes,
    roundName: match.roundName,
    seasonId: match.seasonId,
    homeClubId: match.homeClubId,
    awayClubId: match.awayClubId,
    competitionId: match.competitionId,
    createdAt: match.createdAt.toISOString(),
    updatedAt: match.updatedAt.toISOString(),
  };
}

function mapVideo(video: Video): VideoRecord {
  return {
    id: video.id,
    matchId: video.matchId,
    fileName: video.fileName,
    fileSize: Number(video.fileSize),
    durationSeconds: video.durationSeconds,
    mimeType: video.mimeType,
    lastModified: video.lastModified?.toISOString() ?? null,
    storageType: "local",
    createdAt: video.createdAt.toISOString(),
    updatedAt: video.updatedAt.toISOString(),
  };
}

function mapMomentType(type: MomentType): MomentTypeRecord {
  return {
    id: type.id,
    name: type.name,
    code: type.code,
    color: type.color,
    defaultShortcut: type.defaultShortcut,
    createdAt: type.createdAt.toISOString(),
    updatedAt: type.updatedAt.toISOString(),
  };
}

function mapSubMomentType(type: SubMomentType): SubMomentTypeRecord {
  return {
    id: type.id,
    name: type.name,
    code: type.code,
    requiresFieldLocation: type.requiresFieldLocation,
    requiresGoalLocation: type.requiresGoalLocation,
    createdAt: type.createdAt.toISOString(),
    updatedAt: type.updatedAt.toISOString(),
  };
}

function mapShortcut(shortcut: ShortcutSetting): ShortcutSettingRecord {
  return {
    id: shortcut.id,
    actionType: shortcut.actionType,
    targetType: shortcut.targetType,
    targetId: shortcut.targetId,
    key: shortcut.key,
    createdAt: shortcut.createdAt.toISOString(),
    updatedAt: shortcut.updatedAt.toISOString(),
  };
}

function mapSubMoment(subMoment: PrismaSubMomentWithType): SubMomentRecord {
  return {
    id: subMoment.id,
    momentId: subMoment.momentId,
    subMomentTypeId: subMoment.subMomentTypeId,
    timeSeconds: subMoment.timeSeconds,
    fieldX: subMoment.fieldX,
    fieldY: subMoment.fieldY,
    goalX: subMoment.goalX,
    goalY: subMoment.goalY,
    notes: subMoment.notes,
    createdAt: subMoment.createdAt.toISOString(),
    updatedAt: subMoment.updatedAt.toISOString(),
    subMomentType: mapSubMomentType(subMoment.subMomentType),
  };
}

function mapMoment(moment: PrismaMomentWithRelations): MomentRecord {
  return {
    id: moment.id,
    matchId: moment.matchId,
    videoId: moment.videoId,
    momentTypeId: moment.momentTypeId,
    startTimeSeconds: moment.startTimeSeconds,
    endTimeSeconds: moment.endTimeSeconds,
    durationSeconds: moment.durationSeconds,
    notes: moment.notes,
    createdAt: moment.createdAt.toISOString(),
    updatedAt: moment.updatedAt.toISOString(),
    momentType: mapMomentType(moment.momentType),
    subMoments: moment.subMoments.map(mapSubMoment),
  };
}

function normalizeDateInput(date?: string | null) {
  if (!date) {
    return null;
  }

  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function momentDuration(start: number, end: number) {
  return Math.max(0, Math.round((end - start) * 10) / 10);
}

function sortByDefaultOrder<T extends { code: string; createdAt: string; name: string }>(
  records: T[],
  defaults: { code: string }[],
) {
  const order = new Map(defaults.map((item, index) => [item.code, index]));

  return [...records].sort((a, b) => {
    const aOrder = order.get(a.code) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = order.get(b.code) ?? Number.MAX_SAFE_INTEGER;

    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    return a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name);
  });
}

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

async function deleteUnusedLegacySubMomentTypes() {
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
}

function hydrateMemorySubMoment(store: MemoryStore, subMoment: MemorySubMoment): SubMomentRecord {
  const subMomentType = store.subMomentTypes.find((type) => type.id === subMoment.subMomentTypeId);
  if (!subMomentType) {
    throw new Error("Submoment type not found.");
  }

  return {
    ...subMoment,
    subMomentType,
  };
}

function hydrateMemoryMoment(store: MemoryStore, moment: MemoryMoment): MomentRecord {
  const momentType = store.momentTypes.find((type) => type.id === moment.momentTypeId);
  if (!momentType) {
    throw new Error("Moment type not found.");
  }

  return {
    ...moment,
    momentType,
    subMoments: store.subMoments
      .filter((subMoment) => subMoment.momentId === moment.id)
      .map((subMoment) => hydrateMemorySubMoment(store, subMoment))
      .sort((a, b) => (a.timeSeconds ?? 0) - (b.timeSeconds ?? 0)),
  };
}

export async function listSettings(): Promise<SettingsPayload> {
  if (shouldUseDatabase()) {
    await ensureDatabaseDefaults();
    const [momentTypes, subMomentTypes, shortcuts] = await Promise.all([
      prisma.momentType.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.subMomentType.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.shortcutSetting.findMany({ orderBy: { createdAt: "asc" } }),
    ]);

    return {
      momentTypes: sortByDefaultOrder(momentTypes.map(mapMomentType), defaultMomentTypes),
      subMomentTypes: sortByDefaultOrder(subMomentTypes.map(mapSubMomentType), defaultSubMomentTypes),
      shortcuts: shortcuts.map(mapShortcut),
    };
  }

  const store = getMemoryStore();
  return {
    momentTypes: sortByDefaultOrder(store.momentTypes, defaultMomentTypes),
    subMomentTypes: sortByDefaultOrder(store.subMomentTypes, defaultSubMomentTypes),
    shortcuts: store.shortcuts,
  };
}

export async function listMatches(): Promise<MatchSummary[]> {
  if (shouldUseDatabase()) {
    await ensureDatabaseDefaults();
    const matches = await prisma.match.findMany({
      include: {
        videos: { orderBy: { updatedAt: "desc" }, take: 1 },
        _count: { select: { moments: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return matches.map((match) => ({
      ...mapMatch(match),
      video: match.videos[0] ? mapVideo(match.videos[0]) : null,
      momentCount: match._count.moments,
    }));
  }

  const store = getMemoryStore();
  return store.matches
    .map((match) => ({
      ...match,
      video: store.videos.find((video) => video.matchId === match.id) ?? null,
      momentCount: store.moments.filter((moment) => moment.matchId === match.id).length,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getMatchDetail(matchId: string): Promise<MatchDetail | null> {
  if (shouldUseDatabase()) {
    await ensureDatabaseDefaults();
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        videos: { orderBy: { updatedAt: "desc" }, take: 1 },
        moments: {
          include: {
            momentType: true,
            subMoments: {
              include: { subMomentType: true },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { startTimeSeconds: "asc" },
        },
      },
    });

    if (!match) {
      return null;
    }

    return {
      ...mapMatch(match),
      video: match.videos[0] ? mapVideo(match.videos[0]) : null,
      momentCount: match.moments.length,
      moments: match.moments.map(mapMoment),
    };
  }

  const store = getMemoryStore();
  const match = store.matches.find((item) => item.id === matchId);
  if (!match) {
    return null;
  }

  const moments = store.moments
    .filter((moment) => moment.matchId === matchId)
    .map((moment) => hydrateMemoryMoment(store, moment))
    .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);

  return {
    ...match,
    video: store.videos.find((video) => video.matchId === matchId) ?? null,
    momentCount: moments.length,
    moments,
  };
}

export async function createMatch(input: CreateMatchInput): Promise<MatchRecord> {
  const teamName = input.teamName.trim();
  const opponentName = input.opponentName.trim();
  const roundName = input.roundName?.trim();
  const title = input.title?.trim() || `${roundName ? `Jornada ${roundName}` : "Jogo"} - ${teamName} vs ${opponentName}`;

  if (!teamName || !opponentName || !roundName) {
    throw new Error("A jornada e as duas equipas são obrigatórias.");
  }
  if (input.homeClubId && input.homeClubId === input.awayClubId) {
    throw new Error("As equipas da casa e visitante têm de ser diferentes.");
  }

  if (shouldUseDatabase()) {
    await ensureDatabaseDefaults();
    if (!input.seasonId || !input.competitionId || !input.homeClubId || !input.awayClubId) {
      throw new Error("Temporada, competição e equipas são obrigatórias.");
    }
    const selectedCompetition = await prisma.competition.findFirst({
      where: { id: input.competitionId, seasonId: input.seasonId },
      include: { clubs: { where: { id: { in: [input.homeClubId, input.awayClubId] } }, select: { id: true } } },
    });
    if (!selectedCompetition || selectedCompetition.clubs.length !== 2) {
      throw new Error("A competição ou as equipas selecionadas não pertencem à temporada indicada.");
    }
    const match = await prisma.match.create({
      data: {
        title,
        teamName,
        opponentName,
        matchDate: normalizeDateInput(input.matchDate),
        competition: normalizeOptionalText(input.competition),
        venue: normalizeOptionalText(input.venue),
        notes: normalizeOptionalText(input.notes),
        roundName: normalizeOptionalText(input.roundName),
        seasonId: normalizeOptionalText(input.seasonId),
        homeClubId: normalizeOptionalText(input.homeClubId),
        awayClubId: normalizeOptionalText(input.awayClubId),
        competitionId: normalizeOptionalText(input.competitionId),
      },
    });
    return mapMatch(match);
  }

  const store = getMemoryStore();
  const createdAt = now();
  const match: MatchRecord = {
    id: id(),
    title,
    teamName,
    opponentName,
    matchDate: normalizeDateInput(input.matchDate)?.toISOString() ?? null,
    competition: normalizeOptionalText(input.competition),
    venue: normalizeOptionalText(input.venue),
    notes: normalizeOptionalText(input.notes),
    roundName: normalizeOptionalText(input.roundName),
    seasonId: normalizeOptionalText(input.seasonId),
    homeClubId: normalizeOptionalText(input.homeClubId),
    awayClubId: normalizeOptionalText(input.awayClubId),
    competitionId: normalizeOptionalText(input.competitionId),
    createdAt,
    updatedAt: createdAt,
  };
  store.matches.push(match);
  return match;
}

export async function updateMatch(matchId: string, input: UpdateMatchInput): Promise<MatchRecord> {
  if (shouldUseDatabase()) {
    const match = await prisma.match.update({
      where: { id: matchId },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.teamName !== undefined ? { teamName: input.teamName.trim() } : {}),
        ...(input.opponentName !== undefined ? { opponentName: input.opponentName.trim() } : {}),
        ...(input.matchDate !== undefined ? { matchDate: normalizeDateInput(input.matchDate) } : {}),
        ...(input.competition !== undefined ? { competition: normalizeOptionalText(input.competition) } : {}),
        ...(input.venue !== undefined ? { venue: normalizeOptionalText(input.venue) } : {}),
        ...(input.notes !== undefined ? { notes: normalizeOptionalText(input.notes) } : {}),
        ...(input.roundName !== undefined ? { roundName: normalizeOptionalText(input.roundName) } : {}),
        ...(input.seasonId !== undefined ? { seasonId: normalizeOptionalText(input.seasonId) } : {}),
        ...(input.homeClubId !== undefined ? { homeClubId: normalizeOptionalText(input.homeClubId) } : {}),
        ...(input.awayClubId !== undefined ? { awayClubId: normalizeOptionalText(input.awayClubId) } : {}),
        ...(input.competitionId !== undefined ? { competitionId: normalizeOptionalText(input.competitionId) } : {}),
      },
    });
    return mapMatch(match);
  }

  const store = getMemoryStore();
  const match = store.matches.find((item) => item.id === matchId);
  if (!match) {
    throw new Error("Match not found.");
  }

  if (input.title !== undefined) {
    match.title = input.title.trim();
  }
  if (input.teamName !== undefined) {
    match.teamName = input.teamName.trim() || null;
  }
  if (input.opponentName !== undefined) {
    match.opponentName = input.opponentName.trim();
  }
  if (input.matchDate !== undefined) {
    match.matchDate = normalizeDateInput(input.matchDate)?.toISOString() ?? null;
  }
  if (input.competition !== undefined) {
    match.competition = normalizeOptionalText(input.competition);
  }
  if (input.venue !== undefined) {
    match.venue = normalizeOptionalText(input.venue);
  }
  if (input.notes !== undefined) {
    match.notes = normalizeOptionalText(input.notes);
  }
  if (input.roundName !== undefined) match.roundName = normalizeOptionalText(input.roundName);
  if (input.seasonId !== undefined) match.seasonId = normalizeOptionalText(input.seasonId);
  if (input.homeClubId !== undefined) match.homeClubId = normalizeOptionalText(input.homeClubId);
  if (input.awayClubId !== undefined) match.awayClubId = normalizeOptionalText(input.awayClubId);
  if (input.competitionId !== undefined) match.competitionId = normalizeOptionalText(input.competitionId);
  match.updatedAt = now();

  return match;
}

export async function deleteMatch(matchId: string) {
  if (shouldUseDatabase()) {
    await prisma.match.delete({ where: { id: matchId } });
    return;
  }

  const store = getMemoryStore();
  store.matches = store.matches.filter((match) => match.id !== matchId);
  store.videos = store.videos.filter((video) => video.matchId !== matchId);
  const deletedMomentIds = store.moments.filter((moment) => moment.matchId === matchId).map((moment) => moment.id);
  store.moments = store.moments.filter((moment) => moment.matchId !== matchId);
  store.subMoments = store.subMoments.filter((subMoment) => !deletedMomentIds.includes(subMoment.momentId));
}

export async function upsertVideoMetadata(matchId: string, input: VideoMetadataInput): Promise<VideoRecord> {
  const lastModified = input.lastModified ? normalizeDateInput(input.lastModified) : null;

  if (shouldUseDatabase()) {
    await ensureDatabaseDefaults();
    const existing = await prisma.video.findFirst({
      where: { matchId },
      orderBy: { updatedAt: "desc" },
    });

    const data = {
      fileName: input.fileName,
      fileSize: BigInt(input.fileSize),
      durationSeconds: input.durationSeconds,
      mimeType: input.mimeType,
      lastModified,
      storageType: "local",
    };

    const video = existing
      ? await prisma.video.update({ where: { id: existing.id }, data })
      : await prisma.video.create({ data: { ...data, matchId } });

    return mapVideo(video);
  }

  const store = getMemoryStore();
  const existing = store.videos.find((video) => video.matchId === matchId);
  const timestamp = now();

  if (existing) {
    existing.fileName = input.fileName;
    existing.fileSize = input.fileSize;
    existing.durationSeconds = input.durationSeconds;
    existing.mimeType = input.mimeType;
    existing.lastModified = lastModified?.toISOString() ?? null;
    existing.updatedAt = timestamp;
    return existing;
  }

  const video: VideoRecord = {
    id: id(),
    matchId,
    fileName: input.fileName,
    fileSize: input.fileSize,
    durationSeconds: input.durationSeconds,
    mimeType: input.mimeType,
    lastModified: lastModified?.toISOString() ?? null,
    storageType: "local",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  store.videos.push(video);
  return video;
}

export async function createMoment(input: CreateMomentInput): Promise<MomentRecord> {
  const start = Math.max(0, input.startTimeSeconds);
  const end = Math.max(start, input.endTimeSeconds);

  if (shouldUseDatabase()) {
    const moment = await prisma.moment.create({
      data: {
        matchId: input.matchId,
        videoId: input.videoId ?? null,
        momentTypeId: input.momentTypeId,
        startTimeSeconds: start,
        endTimeSeconds: end,
        durationSeconds: momentDuration(start, end),
        notes: normalizeOptionalText(input.notes),
      },
      include: {
        momentType: true,
        subMoments: { include: { subMomentType: true } },
      },
    });
    return mapMoment(moment);
  }

  const store = getMemoryStore();
  const momentType = store.momentTypes.find((type) => type.id === input.momentTypeId);
  if (!momentType) {
    throw new Error("Moment type not found.");
  }

  const timestamp = now();
  const moment: MemoryMoment = {
    id: id(),
    matchId: input.matchId,
    videoId: input.videoId ?? null,
    momentTypeId: input.momentTypeId,
    startTimeSeconds: start,
    endTimeSeconds: end,
    durationSeconds: momentDuration(start, end),
    notes: normalizeOptionalText(input.notes),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  store.moments.push(moment);
  return hydrateMemoryMoment(store, moment);
}

export async function updateMoment(momentId: string, input: UpdateMomentInput): Promise<MomentRecord> {
  if (shouldUseDatabase()) {
    const current = await prisma.moment.findUnique({ where: { id: momentId } });
    if (!current) {
      throw new Error("Moment not found.");
    }

    const start = input.startTimeSeconds ?? current.startTimeSeconds;
    const end = Math.max(start, input.endTimeSeconds ?? current.endTimeSeconds);
    const moment = await prisma.moment.update({
      where: { id: momentId },
      data: {
        ...(input.videoId !== undefined ? { videoId: input.videoId } : {}),
        ...(input.momentTypeId !== undefined ? { momentTypeId: input.momentTypeId } : {}),
        startTimeSeconds: start,
        endTimeSeconds: end,
        durationSeconds: momentDuration(start, end),
        ...(input.notes !== undefined ? { notes: normalizeOptionalText(input.notes) } : {}),
      },
      include: {
        momentType: true,
        subMoments: { include: { subMomentType: true }, orderBy: { createdAt: "asc" } },
      },
    });
    return mapMoment(moment);
  }

  const store = getMemoryStore();
  const moment = store.moments.find((item) => item.id === momentId);
  if (!moment) {
    throw new Error("Moment not found.");
  }

  if (input.videoId !== undefined) {
    moment.videoId = input.videoId;
  }
  if (input.momentTypeId !== undefined) {
    moment.momentTypeId = input.momentTypeId;
  }
  if (input.startTimeSeconds !== undefined) {
    moment.startTimeSeconds = Math.max(0, input.startTimeSeconds);
  }
  if (input.endTimeSeconds !== undefined) {
    moment.endTimeSeconds = Math.max(moment.startTimeSeconds, input.endTimeSeconds);
  }
  moment.durationSeconds = momentDuration(moment.startTimeSeconds, moment.endTimeSeconds);
  if (input.notes !== undefined) {
    moment.notes = normalizeOptionalText(input.notes);
  }
  moment.updatedAt = now();

  return hydrateMemoryMoment(store, moment);
}

export async function deleteMoment(momentId: string) {
  if (shouldUseDatabase()) {
    await prisma.moment.delete({ where: { id: momentId } });
    return;
  }

  const store = getMemoryStore();
  store.moments = store.moments.filter((moment) => moment.id !== momentId);
  store.subMoments = store.subMoments.filter((subMoment) => subMoment.momentId !== momentId);
}

export async function createSubMoment(input: CreateSubMomentInput): Promise<SubMomentRecord> {
  if (shouldUseDatabase()) {
    const subMoment = await prisma.subMoment.create({
      data: {
        momentId: input.momentId,
        subMomentTypeId: input.subMomentTypeId,
        timeSeconds: input.timeSeconds ?? null,
        fieldX: input.fieldX ?? null,
        fieldY: input.fieldY ?? null,
        goalX: input.goalX ?? null,
        goalY: input.goalY ?? null,
        notes: normalizeOptionalText(input.notes),
      },
      include: { subMomentType: true },
    });
    return mapSubMoment(subMoment);
  }

  const store = getMemoryStore();
  const subMomentType = store.subMomentTypes.find((type) => type.id === input.subMomentTypeId);
  if (!subMomentType) {
    throw new Error("Submoment type not found.");
  }

  const timestamp = now();
  const subMoment: MemorySubMoment = {
    id: id(),
    momentId: input.momentId,
    subMomentTypeId: input.subMomentTypeId,
    timeSeconds: input.timeSeconds ?? null,
    fieldX: input.fieldX ?? null,
    fieldY: input.fieldY ?? null,
    goalX: input.goalX ?? null,
    goalY: input.goalY ?? null,
    notes: normalizeOptionalText(input.notes),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  store.subMoments.push(subMoment);
  return hydrateMemorySubMoment(store, subMoment);
}

export async function updateSubMoment(subMomentId: string, input: UpdateSubMomentInput): Promise<SubMomentRecord> {
  if (shouldUseDatabase()) {
    const subMoment = await prisma.subMoment.update({
      where: { id: subMomentId },
      data: {
        ...(input.subMomentTypeId !== undefined ? { subMomentTypeId: input.subMomentTypeId } : {}),
        ...(input.timeSeconds !== undefined ? { timeSeconds: input.timeSeconds } : {}),
        ...(input.fieldX !== undefined ? { fieldX: input.fieldX } : {}),
        ...(input.fieldY !== undefined ? { fieldY: input.fieldY } : {}),
        ...(input.goalX !== undefined ? { goalX: input.goalX } : {}),
        ...(input.goalY !== undefined ? { goalY: input.goalY } : {}),
        ...(input.notes !== undefined ? { notes: normalizeOptionalText(input.notes) } : {}),
      },
      include: { subMomentType: true },
    });
    return mapSubMoment(subMoment);
  }

  const store = getMemoryStore();
  const subMoment = store.subMoments.find((item) => item.id === subMomentId);
  if (!subMoment) {
    throw new Error("Submoment not found.");
  }

  if (input.subMomentTypeId !== undefined) {
    subMoment.subMomentTypeId = input.subMomentTypeId;
  }
  if (input.timeSeconds !== undefined) {
    subMoment.timeSeconds = input.timeSeconds;
  }
  if (input.fieldX !== undefined) {
    subMoment.fieldX = input.fieldX;
  }
  if (input.fieldY !== undefined) {
    subMoment.fieldY = input.fieldY;
  }
  if (input.goalX !== undefined) {
    subMoment.goalX = input.goalX;
  }
  if (input.goalY !== undefined) {
    subMoment.goalY = input.goalY;
  }
  if (input.notes !== undefined) {
    subMoment.notes = normalizeOptionalText(input.notes);
  }
  subMoment.updatedAt = now();

  return hydrateMemorySubMoment(store, subMoment);
}

export async function deleteSubMoment(subMomentId: string) {
  if (shouldUseDatabase()) {
    await prisma.subMoment.delete({ where: { id: subMomentId } });
    return;
  }

  const store = getMemoryStore();
  store.subMoments = store.subMoments.filter((subMoment) => subMoment.id !== subMomentId);
}

export async function updateShortcut(shortcutId: string, key: string): Promise<ShortcutSettingRecord> {
  if (shouldUseDatabase()) {
    const shortcut = await prisma.shortcutSetting.update({
      where: { id: shortcutId },
      data: { key },
    });
    return mapShortcut(shortcut);
  }

  const store = getMemoryStore();
  const shortcut = store.shortcuts.find((item) => item.id === shortcutId);
  if (!shortcut) {
    throw new Error("Shortcut not found.");
  }
  shortcut.key = key;
  shortcut.updatedAt = now();
  return shortcut;
}

export async function createMomentType(input: Pick<MomentTypeRecord, "name" | "code" | "color" | "defaultShortcut">) {
  const timestamp = now();
  const code = input.code.trim().toUpperCase();

  if (shouldUseDatabase()) {
    const type = await prisma.momentType.create({
      data: {
        name: input.name.trim(),
        code,
        color: input.color,
        defaultShortcut: input.defaultShortcut,
      },
    });
    await prisma.shortcutSetting.create({
      data: {
        actionType: "moment.toggle",
        targetType: "momentType",
        targetId: type.id,
        key: input.defaultShortcut,
      },
    });
    return mapMomentType(type);
  }

  const store = getMemoryStore();
  const type: MomentTypeRecord = {
    id: id(),
    name: input.name.trim(),
    code,
    color: input.color,
    defaultShortcut: input.defaultShortcut,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  store.momentTypes.push(type);
  store.shortcuts.push({
    id: id(),
    actionType: "moment.toggle",
    targetType: "momentType",
    targetId: type.id,
    key: type.defaultShortcut,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return type;
}

export async function updateMomentType(
  momentTypeId: string,
  input: Partial<Pick<MomentTypeRecord, "name" | "code" | "color" | "defaultShortcut">>,
) {
  if (shouldUseDatabase()) {
    const type = await prisma.momentType.update({
      where: { id: momentTypeId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.code !== undefined ? { code: input.code.trim().toUpperCase() } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.defaultShortcut !== undefined ? { defaultShortcut: input.defaultShortcut } : {}),
      },
    });

    if (input.defaultShortcut !== undefined) {
      await prisma.shortcutSetting.updateMany({
        where: { actionType: "moment.toggle", targetType: "momentType", targetId: momentTypeId },
        data: { key: input.defaultShortcut },
      });
    }

    return mapMomentType(type);
  }

  const store = getMemoryStore();
  const type = store.momentTypes.find((item) => item.id === momentTypeId);
  if (!type) {
    throw new Error("Moment type not found.");
  }
  if (input.name !== undefined) {
    type.name = input.name.trim();
  }
  if (input.code !== undefined) {
    type.code = input.code.trim().toUpperCase();
  }
  if (input.color !== undefined) {
    type.color = input.color;
  }
  if (input.defaultShortcut !== undefined) {
    type.defaultShortcut = input.defaultShortcut;
    const shortcut = store.shortcuts.find(
      (item) => item.actionType === "moment.toggle" && item.targetType === "momentType" && item.targetId === momentTypeId,
    );
    if (shortcut) {
      shortcut.key = input.defaultShortcut;
      shortcut.updatedAt = now();
    }
  }
  type.updatedAt = now();
  return type;
}

export async function deleteMomentType(momentTypeId: string) {
  if (shouldUseDatabase()) {
    const count = await prisma.moment.count({ where: { momentTypeId } });
    if (count > 0) {
      throw new Error("Cannot delete a type with associated moments.");
    }
    await prisma.shortcutSetting.deleteMany({ where: { targetType: "momentType", targetId: momentTypeId } });
    await prisma.momentType.delete({ where: { id: momentTypeId } });
    return;
  }

  const store = getMemoryStore();
  if (store.moments.some((moment) => moment.momentTypeId === momentTypeId)) {
    throw new Error("Cannot delete a type with associated moments.");
  }
  store.momentTypes = store.momentTypes.filter((type) => type.id !== momentTypeId);
  store.shortcuts = store.shortcuts.filter((shortcut) => shortcut.targetId !== momentTypeId);
}

export async function createSubMomentType(
  input: Pick<SubMomentTypeRecord, "name" | "code" | "requiresFieldLocation" | "requiresGoalLocation">,
) {
  const timestamp = now();
  const code = input.code.trim().toUpperCase();

  if (shouldUseDatabase()) {
    const type = await prisma.subMomentType.create({
      data: {
        name: input.name.trim(),
        code,
        requiresFieldLocation: input.requiresFieldLocation,
        requiresGoalLocation: input.requiresGoalLocation,
      },
    });
    return mapSubMomentType(type);
  }

  const store = getMemoryStore();
  const type: SubMomentTypeRecord = {
    id: id(),
    name: input.name.trim(),
    code,
    requiresFieldLocation: input.requiresFieldLocation,
    requiresGoalLocation: input.requiresGoalLocation,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  store.subMomentTypes.push(type);
  return type;
}

export async function updateSubMomentType(
  subMomentTypeId: string,
  input: Partial<Pick<SubMomentTypeRecord, "name" | "code" | "requiresFieldLocation" | "requiresGoalLocation">>,
) {
  if (shouldUseDatabase()) {
    const type = await prisma.subMomentType.update({
      where: { id: subMomentTypeId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.code !== undefined ? { code: input.code.trim().toUpperCase() } : {}),
        ...(input.requiresFieldLocation !== undefined ? { requiresFieldLocation: input.requiresFieldLocation } : {}),
        ...(input.requiresGoalLocation !== undefined ? { requiresGoalLocation: input.requiresGoalLocation } : {}),
      },
    });
    return mapSubMomentType(type);
  }

  const store = getMemoryStore();
  const type = store.subMomentTypes.find((item) => item.id === subMomentTypeId);
  if (!type) {
    throw new Error("Submoment type not found.");
  }
  if (input.name !== undefined) {
    type.name = input.name.trim();
  }
  if (input.code !== undefined) {
    type.code = input.code.trim().toUpperCase();
  }
  if (input.requiresFieldLocation !== undefined) {
    type.requiresFieldLocation = input.requiresFieldLocation;
  }
  if (input.requiresGoalLocation !== undefined) {
    type.requiresGoalLocation = input.requiresGoalLocation;
  }
  type.updatedAt = now();
  return type;
}

export async function deleteSubMomentType(subMomentTypeId: string) {
  if (shouldUseDatabase()) {
    const count = await prisma.subMoment.count({ where: { subMomentTypeId } });
    if (count > 0) {
      throw new Error("Cannot delete a type with associated submoments.");
    }
    await prisma.subMomentType.delete({ where: { id: subMomentTypeId } });
    return;
  }

  const store = getMemoryStore();
  if (store.subMoments.some((subMoment) => subMoment.subMomentTypeId === subMomentTypeId)) {
    throw new Error("Cannot delete a type with associated submoments.");
  }
  store.subMomentTypes = store.subMomentTypes.filter((type) => type.id !== subMomentTypeId);
}
