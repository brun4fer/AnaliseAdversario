export type Id = string;

export type StorageType = "local" | "r2";
export type VideoStorageStatus = "LOCAL" | "UPLOADING" | "READY" | "FAILED";

export type MatchRecord = {
  id: Id;
  title: string;
  teamName: string | null;
  opponentName: string;
  matchDate: string | null;
  competition: string | null;
  venue: string | null;
  notes: string | null;
  roundName: string | null;
  seasonId: string | null;
  homeClubId: string | null;
  awayClubId: string | null;
  competitionId: string | null;
  firstHalfStartSeconds: number | null;
  firstHalfEndSeconds: number | null;
  secondHalfStartSeconds: number | null;
  secondHalfEndSeconds: number | null;
  homeClubName: string | null;
  homeClubShortName: string | null;
  homeClubLogoDataUrl: string | null;
  awayClubName: string | null;
  awayClubShortName: string | null;
  awayClubLogoDataUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MatchSummary = MatchRecord & {
  momentCount: number;
  video: VideoRecord | null;
  analyses: MatchAnalysisRecord[];
};

export type MatchAnalysisPerspective = "opponent" | "team";

export type MatchAnalysisRecord = {
  id: Id;
  matchId: Id;
  perspective: MatchAnalysisPerspective;
  analysedTeamName: string;
  createdAt: string;
  updatedAt: string;
};

export type VideoRecord = {
  id: Id;
  matchId: Id;
  fileName: string;
  fileSize: number;
  durationSeconds: number;
  mimeType: string;
  lastModified: string | null;
  storageType: StorageType;
  storageStatus: VideoStorageStatus;
  uploadedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MomentTypeRecord = {
  id: Id;
  name: string;
  code: string;
  color: string;
  defaultShortcut: string;
  createdAt: string;
  updatedAt: string;
};

export type MomentRecord = {
  id: Id;
  matchId: Id;
  videoId: Id | null;
  momentTypeId: Id;
  startTimeSeconds: number;
  endTimeSeconds: number;
  durationSeconds: number;
  sortOrder: number;
  notes: string | null;
  outcome: "positive" | "negative" | null;
  createdAt: string;
  updatedAt: string;
  momentType: MomentTypeRecord;
  subMoments: SubMomentRecord[];
};

export type SubMomentTypeRecord = {
  id: Id;
  name: string;
  code: string;
  sortOrder: number;
  requiresFieldLocation: boolean;
  requiresGoalLocation: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SubMomentRecord = {
  id: Id;
  momentId: Id;
  subMomentTypeId: Id;
  timeSeconds: number | null;
  fieldX: number | null;
  fieldY: number | null;
  goalX: number | null;
  goalY: number | null;
  notes: string | null;
  outcome: "positive" | "negative" | null;
  createdAt: string;
  updatedAt: string;
  subMomentType: SubMomentTypeRecord;
};

export type ShortcutSettingRecord = {
  id: Id;
  actionType: string;
  targetType: string;
  targetId: Id | null;
  key: string;
  createdAt: string;
  updatedAt: string;
};

export type MatchDetail = MatchSummary & {
  moments: MomentRecord[];
  scoreEvents: MatchScoreEventRecord[];
};

export type MatchScoreEventRecord = {
  id: Id;
  matchId: Id;
  timeSeconds: number;
  homeScore: number;
  awayScore: number;
  homeRedCards: number;
  awayRedCards: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateMatchInput = {
  title?: string;
  teamName: string;
  opponentName: string;
  matchDate?: string | null;
  competition?: string | null;
  venue?: string | null;
  notes?: string | null;
  roundName?: string | null;
  seasonId?: string | null;
  homeClubId?: string | null;
  awayClubId?: string | null;
  competitionId?: string | null;
  firstHalfStartSeconds?: number | null;
  firstHalfEndSeconds?: number | null;
  secondHalfStartSeconds?: number | null;
  secondHalfEndSeconds?: number | null;
  analysisPerspective?: MatchAnalysisPerspective;
};

export type MaintenanceRecord = { id: Id; name: string; shortName?: string | null; logoDataUrl?: string | null; startDate?: string | null; endDate?: string | null; seasonId?: string | null; clubIds?: string[]; createdAt: string; updatedAt: string };

export type UpdateMatchInput = Partial<CreateMatchInput>;

export type VideoMetadataInput = {
  fileName: string;
  fileSize: number;
  durationSeconds: number;
  mimeType: string;
  lastModified?: string | null;
};

export type CreateMomentInput = {
  matchId: Id;
  videoId?: Id | null;
  momentTypeId: Id;
  startTimeSeconds: number;
  endTimeSeconds: number;
  sortOrder?: number;
  notes?: string | null;
  outcome?: "positive" | "negative" | null;
};

export type UpdateMomentInput = Partial<Omit<CreateMomentInput, "matchId">>;

export type CreateSubMomentInput = {
  momentId: Id;
  subMomentTypeId: Id;
  timeSeconds?: number | null;
  fieldX?: number | null;
  fieldY?: number | null;
  goalX?: number | null;
  goalY?: number | null;
  notes?: string | null;
  outcome?: "positive" | "negative" | null;
};

export type UpdateSubMomentInput = Partial<Omit<CreateSubMomentInput, "momentId">>;

export type SettingsPayload = {
  momentTypes: MomentTypeRecord[];
  subMomentTypes: SubMomentTypeRecord[];
  shortcuts: ShortcutSettingRecord[];
};
