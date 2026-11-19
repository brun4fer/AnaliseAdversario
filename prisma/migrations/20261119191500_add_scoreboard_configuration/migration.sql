-- Per-match scoreboard overrides. These do not modify the club records used
-- elsewhere in the opponent analysis workspace.
ALTER TABLE "Match" ADD COLUMN "homeClubName" TEXT;
ALTER TABLE "Match" ADD COLUMN "awayClubName" TEXT;
ALTER TABLE "Match" ADD COLUMN "homeClubShortName" TEXT;
ALTER TABLE "Match" ADD COLUMN "awayClubShortName" TEXT;
ALTER TABLE "Match" ADD COLUMN "homeClubLogoDataUrl" TEXT;
ALTER TABLE "Match" ADD COLUMN "awayClubLogoDataUrl" TEXT;
