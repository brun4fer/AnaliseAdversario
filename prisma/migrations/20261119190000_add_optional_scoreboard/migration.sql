ALTER TABLE "Match" ADD COLUMN "scoreboardEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Existing matches keep the scoreboard they already had. New matches start with
-- the optional scoreboard disabled unless the analyst enables it.
ALTER TABLE "Match" ALTER COLUMN "scoreboardEnabled" SET DEFAULT false;
