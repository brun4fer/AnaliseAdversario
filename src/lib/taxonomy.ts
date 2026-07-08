import type { MomentTypeRecord, SubMomentTypeRecord } from "@/lib/domain";

export const APP_NAME = "AP - Video Análise - Adversário";

export const subMomentShortcutKeys = ["Q", "W", "E", "R", "T", "Y", "U", "I"];

const sharedSubMomentParentCodes: Record<string, string> = {
  BPD: "BP",
  BPO: "BP",
};

export function getSubMomentParentCode(subMomentType: SubMomentTypeRecord) {
  const [parentCode] = subMomentType.code.split("_");
  return parentCode || null;
}

export function getSubMomentTypesForMoment(
  subMomentTypes: SubMomentTypeRecord[],
  momentType: MomentTypeRecord | null,
) {
  if (!momentType) {
    return [];
  }

  const parentCode = sharedSubMomentParentCodes[momentType.code] ?? momentType.code;
  const typedSubMoments = subMomentTypes.filter(
    (subMomentType) => getSubMomentParentCode(subMomentType) === parentCode,
  );

  return typedSubMoments.length > 0 ? typedSubMoments : subMomentTypes;
}

export function getSubMomentShortcut(index: number) {
  return subMomentShortcutKeys[index] ?? null;
}

export function requiresGoalLocationForSubMoment(subMomentType: SubMomentTypeRecord) {
  return (
    subMomentType.requiresGoalLocation ||
    subMomentType.code.endsWith("_FINALIZACAO") ||
    subMomentType.code.endsWith("_GOLO") ||
    subMomentType.code.endsWith("_PENALTI")
  );
}
