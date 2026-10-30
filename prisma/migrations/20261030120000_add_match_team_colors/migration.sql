ALTER TABLE "Match"
ADD COLUMN "homeTeamColor" TEXT NOT NULL DEFAULT '#D91E36',
ADD COLUMN "awayTeamColor" TEXT NOT NULL DEFAULT '#1D4ED8';

UPDATE "Match" AS m
SET "homeTeamColor" = club."color"
FROM "Club" AS club
WHERE m."homeClubId" = club."id";

UPDATE "Match" AS m
SET "awayTeamColor" = club."color"
FROM "Club" AS club
WHERE m."awayClubId" = club."id";

ALTER TABLE "Club" DROP COLUMN "color";
