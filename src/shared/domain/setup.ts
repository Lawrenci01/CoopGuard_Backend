export interface HouseSurveyDraft {
  farmName: string;
  houseName: string;
  houseType: "open" | "tunnel" | "unknown";
  controller: "present" | "absent" | "unknown";
  flock: "broiler" | "layer" | "unknown";
  lengthMetres: number;
  widthMetres: number;
}

export function validSurvey(value: unknown): value is HouseSurveyDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  return (
    typeof draft.farmName === "string" &&
    draft.farmName.trim().length > 0 &&
    draft.farmName.length <= 80 &&
    typeof draft.houseName === "string" &&
    draft.houseName.trim().length > 0 &&
    draft.houseName.length <= 80 &&
    ["open", "tunnel", "unknown"].includes(String(draft.houseType)) &&
    ["present", "absent", "unknown"].includes(String(draft.controller)) &&
    ["broiler", "layer", "unknown"].includes(String(draft.flock)) &&
    typeof draft.lengthMetres === "number" &&
    Number.isFinite(draft.lengthMetres) &&
    draft.lengthMetres > 0 &&
    draft.lengthMetres <= 1000 &&
    typeof draft.widthMetres === "number" &&
    Number.isFinite(draft.widthMetres) &&
    draft.widthMetres > 0 &&
    draft.widthMetres <= 1000
  );
}

export function surveyRecommendation(
  draft: HouseSurveyDraft,
): "monitor" | "review" | "eligible" {
  if (draft.controller === "present") return "monitor";
  if (draft.controller === "unknown" || draft.houseType !== "open")
    return "review";
  return "eligible";
}

export function suggestedSections(draft: HouseSurveyDraft): number {
  return Math.max(
    1,
    Math.ceil(Math.max(draft.lengthMetres, draft.widthMetres) / 30),
  );
}
