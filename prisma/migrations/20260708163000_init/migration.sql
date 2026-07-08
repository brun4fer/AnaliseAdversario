-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "opponentName" TEXT NOT NULL,
    "matchDate" TIMESTAMP(3),
    "competition" TEXT,
    "venue" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "durationSeconds" DOUBLE PRECISION NOT NULL,
    "mimeType" TEXT NOT NULL,
    "lastModified" TIMESTAMP(3),
    "storageType" TEXT NOT NULL DEFAULT 'local',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MomentType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "defaultShortcut" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MomentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Moment" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "videoId" TEXT,
    "momentTypeId" TEXT NOT NULL,
    "startTimeSeconds" DOUBLE PRECISION NOT NULL,
    "endTimeSeconds" DOUBLE PRECISION NOT NULL,
    "durationSeconds" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Moment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubMomentType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "requiresFieldLocation" BOOLEAN NOT NULL DEFAULT true,
    "requiresGoalLocation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubMomentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubMoment" (
    "id" TEXT NOT NULL,
    "momentId" TEXT NOT NULL,
    "subMomentTypeId" TEXT NOT NULL,
    "timeSeconds" DOUBLE PRECISION,
    "fieldX" DOUBLE PRECISION,
    "fieldY" DOUBLE PRECISION,
    "goalX" DOUBLE PRECISION,
    "goalY" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubMoment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShortcutSetting" (
    "id" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShortcutSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Video_matchId_idx" ON "Video"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "MomentType_code_key" ON "MomentType"("code");

-- CreateIndex
CREATE INDEX "Moment_matchId_idx" ON "Moment"("matchId");

-- CreateIndex
CREATE INDEX "Moment_videoId_idx" ON "Moment"("videoId");

-- CreateIndex
CREATE INDEX "Moment_momentTypeId_idx" ON "Moment"("momentTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "SubMomentType_code_key" ON "SubMomentType"("code");

-- CreateIndex
CREATE INDEX "SubMoment_momentId_idx" ON "SubMoment"("momentId");

-- CreateIndex
CREATE INDEX "SubMoment_subMomentTypeId_idx" ON "SubMoment"("subMomentTypeId");

-- CreateIndex
CREATE INDEX "ShortcutSetting_actionType_targetType_targetId_idx" ON "ShortcutSetting"("actionType", "targetType", "targetId");

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Moment" ADD CONSTRAINT "Moment_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Moment" ADD CONSTRAINT "Moment_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Moment" ADD CONSTRAINT "Moment_momentTypeId_fkey" FOREIGN KEY ("momentTypeId") REFERENCES "MomentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubMoment" ADD CONSTRAINT "SubMoment_momentId_fkey" FOREIGN KEY ("momentId") REFERENCES "Moment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubMoment" ADD CONSTRAINT "SubMoment_subMomentTypeId_fkey" FOREIGN KEY ("subMomentTypeId") REFERENCES "SubMomentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
