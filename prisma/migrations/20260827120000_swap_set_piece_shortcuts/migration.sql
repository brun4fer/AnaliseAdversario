-- Keep the moment buttons and keyboard shortcuts in alternating
-- offensive/defensive order for every existing workspace.
UPDATE "MomentType"
SET
  "defaultShortcut" = CASE
    WHEN "code" = 'OSP' THEN '5'
    WHEN "code" = 'DSP' THEN '6'
  END,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" IN ('OSP', 'DSP');

UPDATE "ShortcutSetting" AS shortcut
SET
  "key" = CASE
    WHEN moment_type."code" = 'OSP' THEN '5'
    WHEN moment_type."code" = 'DSP' THEN '6'
  END,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "MomentType" AS moment_type
WHERE shortcut."targetId" = moment_type."id"
  AND shortcut."actionType" = 'moment.toggle'
  AND shortcut."targetType" = 'momentType'
  AND moment_type."code" IN ('OSP', 'DSP');
