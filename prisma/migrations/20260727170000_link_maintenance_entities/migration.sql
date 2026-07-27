ALTER TABLE "Competition" ADD COLUMN "seasonId" TEXT;
DROP INDEX "Competition_name_key";
CREATE INDEX "Competition_seasonId_idx" ON "Competition"("seasonId");
CREATE UNIQUE INDEX "Competition_seasonId_name_key" ON "Competition"("seasonId", "name");
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "_ClubToCompetition" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);
CREATE UNIQUE INDEX "_ClubToCompetition_AB_unique" ON "_ClubToCompetition"("A", "B");
CREATE INDEX "_ClubToCompetition_B_index" ON "_ClubToCompetition"("B");
ALTER TABLE "_ClubToCompetition" ADD CONSTRAINT "_ClubToCompetition_A_fkey" FOREIGN KEY ("A") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ClubToCompetition" ADD CONSTRAINT "_ClubToCompetition_B_fkey" FOREIGN KEY ("B") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
