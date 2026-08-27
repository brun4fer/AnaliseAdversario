import type { MomentRecord, MomentTypeRecord } from "@/lib/domain";

export type AnalysisPerspective = "opponent" | "team";
export type AnalysisOutcome = "positive" | "negative" | null;

const oppositeMomentCodes: Record<string, string> = {
  OO: "DO",
  DO: "OO",
  OT: "DT",
  DT: "OT",
  OSP: "DSP",
  DSP: "OSP",
  BPO: "BPD",
  BPD: "BPO",
};

export function normalizeAnalysisPerspective(value: string | string[] | undefined): AnalysisPerspective {
  return value === "team" ? "team" : "opponent";
}

export function perspectiveQuery(perspective: AnalysisPerspective) {
  return `perspective=${perspective}`;
}

export function isReversedPerspective(perspective: AnalysisPerspective) {
  return perspective === "team";
}

function oppositeMomentType(type: MomentTypeRecord, allTypes: MomentTypeRecord[]) {
  const oppositeCode = oppositeMomentCodes[type.code.toUpperCase()];
  return oppositeCode ? allTypes.find((candidate) => candidate.code.toUpperCase() === oppositeCode) ?? type : type;
}

export function displayMomentType(
  canonicalType: MomentTypeRecord,
  allTypes: MomentTypeRecord[],
  perspective: AnalysisPerspective,
) {
  return isReversedPerspective(perspective) ? oppositeMomentType(canonicalType, allTypes) : canonicalType;
}

/**
 * Returns normal, familiar UI choices while keeping each choice's id mapped
 * to the canonical type saved by the API.
 */
export function perspectiveMomentTypeChoices(allTypes: MomentTypeRecord[], perspective: AnalysisPerspective) {
  if (!isReversedPerspective(perspective)) return allTypes;
  return allTypes.map((displayType) => {
    const canonicalType = oppositeMomentType(displayType, allTypes);
    return {
      ...displayType,
      id: canonicalType.id,
      createdAt: canonicalType.createdAt,
      updatedAt: canonicalType.updatedAt,
    };
  });
}

export function shortcutSourceTypeId(
  canonicalTypeId: string,
  allTypes: MomentTypeRecord[],
  perspective: AnalysisPerspective,
) {
  if (!isReversedPerspective(perspective)) return canonicalTypeId;
  const canonicalType = allTypes.find((type) => type.id === canonicalTypeId);
  return canonicalType ? oppositeMomentType(canonicalType, allTypes).id : canonicalTypeId;
}

export function displayOutcome(outcome: AnalysisOutcome, perspective: AnalysisPerspective): AnalysisOutcome {
  if (!outcome || !isReversedPerspective(perspective)) return outcome;
  return outcome === "positive" ? "negative" : "positive";
}

export function canonicalOutcome(outcome: AnalysisOutcome, perspective: AnalysisPerspective): AnalysisOutcome {
  return displayOutcome(outcome, perspective);
}

export function displayMoment(
  moment: MomentRecord,
  allTypes: MomentTypeRecord[],
  perspective: AnalysisPerspective,
): MomentRecord {
  if (!isReversedPerspective(perspective)) return moment;
  const momentType = displayMomentType(moment.momentType, allTypes, perspective);
  return {
    ...moment,
    momentTypeId: momentType.id,
    momentType,
    outcome: displayOutcome(moment.outcome, perspective),
    subMoments: moment.subMoments.map((subMoment) => ({
      ...subMoment,
      outcome: displayOutcome(subMoment.outcome, perspective),
    })),
  };
}
