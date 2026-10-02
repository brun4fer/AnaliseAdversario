ALTER TABLE "Moment"
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    "id",
    (ROW_NUMBER() OVER (
      PARTITION BY "matchId", "momentTypeId"
      ORDER BY "startTimeSeconds", "createdAt", "id"
    ) - 1)::INTEGER AS position
  FROM "Moment"
)
UPDATE "Moment" AS moment
SET "sortOrder" = ranked.position
FROM ranked
WHERE moment."id" = ranked."id";
