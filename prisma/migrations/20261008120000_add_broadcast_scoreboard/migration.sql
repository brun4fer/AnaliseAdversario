ALTER TABLE "Club" ADD COLUMN "logoDataUrl" TEXT;

CREATE TABLE "MatchScoreEvent" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "timeSeconds" DOUBLE PRECISION NOT NULL,
    "homeScore" INTEGER NOT NULL,
    "awayScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchScoreEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MatchScoreEvent_matchId_timeSeconds_idx" ON "MatchScoreEvent"("matchId", "timeSeconds");

ALTER TABLE "MatchScoreEvent" ADD CONSTRAINT "MatchScoreEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
