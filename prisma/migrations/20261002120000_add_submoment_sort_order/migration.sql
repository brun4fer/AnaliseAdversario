ALTER TABLE "SubMomentType"
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    "id",
    (ROW_NUMBER() OVER (
      PARTITION BY "ownerId", SPLIT_PART("code", '_', 1)
      ORDER BY
        CASE "code"
          WHEN 'OO_KICKOFF' THEN 0
          WHEN 'OO_GOALKEEPER_BUILDUP' THEN 1
          WHEN 'OO_BUILDUP' THEN 2
          WHEN 'OO_CHANCE_CREATION' THEN 3
          WHEN 'OO_RIGHT_CHANNEL' THEN 4
          WHEN 'OO_LEFT_CHANNEL' THEN 5
          WHEN 'OO_FINISHING' THEN 6
          WHEN 'OO_GOAL' THEN 7
          WHEN 'DO_GOALKEEPER_BUILDUP' THEN 0
          WHEN 'DO_HIGH_BLOCK' THEN 1
          WHEN 'DO_MID_BLOCK' THEN 2
          WHEN 'DO_LOW_BLOCK' THEN 3
          WHEN 'DO_RIGHT_CHANNEL' THEN 4
          WHEN 'DO_LEFT_CHANNEL' THEN 5
          WHEN 'DO_FINISHING' THEN 6
          WHEN 'DO_GOAL' THEN 7
          WHEN 'OT_DEFENSIVE_HALF_RECOVERY' THEN 0
          WHEN 'OT_ATTACKING_HALF_RECOVERY' THEN 1
          WHEN 'OT_FINISHING' THEN 2
          WHEN 'OT_GOAL' THEN 3
          WHEN 'DT_DEFENSIVE_HALF_RECOVERY' THEN 0
          WHEN 'DT_ATTACKING_HALF_RECOVERY' THEN 1
          WHEN 'DT_FINISHING' THEN 2
          WHEN 'DT_GOAL' THEN 3
          WHEN 'SP_CORNER' THEN 0
          WHEN 'SP_THROW_IN' THEN 1
          WHEN 'SP_FREE_KICK' THEN 2
          WHEN 'SP_PENALTY' THEN 3
          WHEN 'SP_FINISHING' THEN 4
          WHEN 'SP_GOAL' THEN 5
          ELSE 1000
        END,
        "createdAt",
        "name"
    ) - 1)::INTEGER AS position
  FROM "SubMomentType"
)
UPDATE "SubMomentType" AS type
SET "sortOrder" = ranked.position
FROM ranked
WHERE type."id" = ranked."id";
