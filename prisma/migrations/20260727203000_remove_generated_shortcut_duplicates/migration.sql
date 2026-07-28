DELETE FROM "ShortcutSetting"
WHERE "ownerId" IS NOT NULL
  AND "id" LIKE "ownerId" || '-sc-%'
  AND EXISTS (
    SELECT 1 FROM "ShortcutSetting" original
    WHERE original."ownerId" = "ShortcutSetting"."ownerId"
      AND original."id" <> "ShortcutSetting"."id"
      AND original."actionType" = "ShortcutSetting"."actionType"
      AND original."targetType" = "ShortcutSetting"."targetType"
      AND original."targetId" IS NOT DISTINCT FROM "ShortcutSetting"."targetId"
  );
