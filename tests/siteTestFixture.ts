import {
  emptyEquipment,
  emptySiteSurvey,
  commissioningChecks,
  installationChecks,
  trialChecks,
} from "../src/shared/domain/siteWorkflow";
import type { LocalFarmRepository } from "../src/shared/services/localFarmRepository";

export function completeSiteSurvey() {
  const survey = emptySiteSurvey();
  Object.assign(survey.farm, {
    farmName: "Pilot farm",
    houseName: "West house",
    address: "Barangay Test, Philippines",
    ownerName: "Farm owner",
    technicianName: "CoopGuard technician",
    photoPermission: "yes",
  });
  survey.goals.recurringProblems = "Heat events are detected late.";
  Object.assign(survey.house, {
    type: "open",
    lengthMetres: 90,
    widthMetres: 12,
  });
  survey.controller.status = "absent";
  Object.assign(survey.power, {
    backup: "yes",
    powerLossProcedure: "Start the generator and inspect ventilation.",
    hubPowerLocation: "Service room outlet",
  });
  Object.assign(survey.connectivity, {
    internet: "yes",
    farmWifi: "yes",
    hubLocation: "Dry service room wall",
    region: "Philippines",
  });
  survey.sensors.plannedNodes = 3;
  survey.operations.dayResponder = "Farm owner";
  survey.operations.powerFailureProcedure =
    "Start the generator and inspect ventilation.";
  Object.assign(survey.safety, {
    wiring: "appears_safe",
    electricalAssessment: "approved",
    assessorName: "Licensed electrical professional",
  });
  const fans = emptyEquipment("fan", "equipment-fans");
  Object.assign(fans, {
    count: 4,
    location: "East wall fan bank",
    model: "Surveyed fan model",
    electricalRating: "230 V, nameplate current recorded",
    stages: "On and off through approved contactor",
    circuit: "Ventilation panel circuit F1",
    condition: "working",
    intendedControl: true,
    failureBehaviour:
      "Return to the electrically approved ventilation fallback.",
  });
  survey.equipment.push(fans);
  Object.assign(survey.evidence, {
    controllerAndEquipment: true,
    panelsAndNameplates: true,
    powerAndGenerator: true,
    hubAndSensorLocations: true,
    hazardsAndWetAreas: true,
  });
  Object.assign(survey.decision, {
    desiredMode: "control",
    ownerAcknowledged: true,
    technicianConfirmed: true,
  });
  return survey;
}

export async function commissionSiteForControl(repo: LocalFarmRepository) {
  await repo.dispatch({
    type: "context",
    patch: { role: "technician", connection: "local" },
  });
  await repo.dispatch({ type: "saveSiteSurvey", value: completeSiteSurvey() });
  await repo.dispatch({ type: "approveSitePlan" });
  await repo.dispatch({ type: "startInstallation" });
  for (const [key] of installationChecks)
    await repo.dispatch({
      type: "siteChecklist",
      stage: "installation",
      key,
      value: "passed",
    });
  await repo.dispatch({ type: "beginCommissioning" });
  for (const [key] of commissioningChecks)
    await repo.dispatch({
      type: "siteChecklist",
      stage: "commissioning",
      key,
      value: "passed",
    });
  await repo.dispatch({ type: "startMonitoringTrial" });
  for (const [key] of trialChecks)
    await repo.dispatch({
      type: "siteChecklist",
      stage: "trial",
      key,
      value: "passed",
    });
  await repo.dispatch({ type: "activateSite", mode: "full" });
  await repo.dispatch({
    type: "context",
    patch: { role: "owner", connection: "local" },
  });
}
