ALTER TABLE "User" ADD COLUMN "username" TEXT,
ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

CREATE TABLE "Season" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "startDate" TIMESTAMP(3), "endDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Season_name_key" ON "Season"("name");
CREATE TABLE "Club" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "shortName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Club_name_key" ON "Club"("name");
CREATE TABLE "Competition" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Competition_name_key" ON "Competition"("name");
ALTER TABLE "Match" ADD COLUMN "roundName" TEXT, ADD COLUMN "seasonId" TEXT, ADD COLUMN "homeClubId" TEXT, ADD COLUMN "awayClubId" TEXT, ADD COLUMN "competitionId" TEXT;
CREATE INDEX "Match_seasonId_idx" ON "Match"("seasonId");
CREATE INDEX "Match_homeClubId_idx" ON "Match"("homeClubId");
CREATE INDEX "Match_awayClubId_idx" ON "Match"("awayClubId");
CREATE INDEX "Match_competitionId_idx" ON "Match"("competitionId");
ALTER TABLE "Match" ADD CONSTRAINT "Match_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_homeClubId_fkey" FOREIGN KEY ("homeClubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_awayClubId_fkey" FOREIGN KEY ("awayClubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
