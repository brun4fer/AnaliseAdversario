CREATE TABLE "MatchAnalysis" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "perspective" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ownerId" TEXT,

  CONSTRAINT "MatchAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MatchAnalysis_matchId_perspective_key"
  ON "MatchAnalysis"("matchId", "perspective");
CREATE INDEX "MatchAnalysis_matchId_idx" ON "MatchAnalysis"("matchId");
CREATE INDEX "MatchAnalysis_ownerId_idx" ON "MatchAnalysis"("ownerId");

ALTER TABLE "MatchAnalysis"
  ADD CONSTRAINT "MatchAnalysis_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchAnalysis"
  ADD CONSTRAINT "MatchAnalysis_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every existing match already has one canonical analysis: the opponent.
INSERT INTO "MatchAnalysis" ("id", "matchId", "perspective", "ownerId", "createdAt", "updatedAt")
SELECT 'analysis-' || "id" || '-opponent', "id", 'opponent', "ownerId", "createdAt", CURRENT_TIMESTAMP
FROM "Match"
ON CONFLICT ("matchId", "perspective") DO NOTHING;
