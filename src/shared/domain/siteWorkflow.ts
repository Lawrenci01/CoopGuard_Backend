import type { HouseSurveyDraft } from "./setup";
import type { MetricKey } from "./types";

export type Answer = "yes" | "no" | "unknown";
export type HouseType = "open" | "tunnel" | "mixed" | "unknown";
export type FlockType = "broiler" | "layer" | "breeder" | "other" | "unknown";
export type ControllerStatus = "present" | "absent" | "unknown";
export type DesiredMode = "monitor" | "control" | "undecided";
export type EquipmentKind =
  "fan" | "heater" | "light" | "cooling" | "curtain" | "pump" | "other";
export type ChecklistValue = "pending" | "passed" | "na";
export type SiteStatus =
  | "not_started"
  | "review_required"
  | "approved_install"
  | "installing"
  | "commissioning"
  | "monitoring_trial"
  | "normal_monitor"
  | "normal_control";

export interface SurveyEquipment {
  id: string;
  kind: EquipmentKind;
  count: number;
  location: string;
  model: string;
  electricalRating: string;
  controlMethod: "manual" | "automatic" | "both" | "unknown";
  condition: "working" | "damaged" | "intermittent" | "unknown";
  stages: string;
  circuit: string;
  backupPower: Answer;
  intendedControl: boolean;
  failureBehaviour: string;
}

export interface SiteSurvey {
  schemaVersion: 1;
  farm: {
    farmName: string;
    houseName: string;
    address: string;
    ownerName: string;
    ownerContact: string;
    visitDate: string;
    technicianName: string;
    photoPermission: Answer;
  };
  goals: {
    recurringProblems: string;
    currentDetection: string;
    currentResponse: string;
    recordsAvailable: Answer;
  };
  flock: {
    type: FlockType;
    breed: string;
    birdCount: number;
    capacity: number;
    startDate: string;
    cycleDays: number;
    ageTargetsAvailable: Answer;
  };
  house: {
    type: HouseType;
    lengthMetres: number;
    widthMetres: number;
    orientation: string;
    structureNotes: string;
    hotColdSpots: string;
    wetAreas: string;
    mountingNotes: string;
  };
  controller: {
    status: ControllerStatus;
    brand: string;
    model: string;
    working: Answer;
    ownerWantsRetained: Answer;
    failureBehaviour: string;
  };
  equipment: SurveyEquipment[];
  power: {
    reliability: "reliable" | "unstable" | "unknown";
    outageHistory: string;
    longestOutage: string;
    backup: Answer;
    backupDetails: string;
    poweredCircuits: string;
    powerLossProcedure: string;
    hubPowerLocation: string;
  };
  connectivity: {
    internet: Answer;
    farmWifi: Answer;
    routerLocation: string;
    hubLocation: string;
    antennaLocation: string;
    radioObstructions: string;
    phoneUseLocations: string;
    region: string;
  };
  sensors: {
    plannedNodes: number;
    temperature: boolean;
    humidity: boolean;
    ammonia: boolean;
    co2: boolean;
    litterMoisture: boolean;
    microphone: boolean;
    placementNotes: string;
  };
  ai: {
    audioConsent: Answer;
    microphoneLocations: string;
    noiseSources: string;
    observationRecorder: string;
    retentionNotes: string;
  };
  operations: {
    dayResponder: string;
    nightResponder: string;
    responseMinutes: number;
    manualOperators: string;
    fanFailureProcedure: string;
    powerFailureProcedure: string;
    highGasProcedure: string;
  };
  safety: {
    wiring: "appears_safe" | "damaged" | "unknown";
    waterRisk: Answer;
    hazards: string;
    electricalAssessment: "approved" | "required" | "not_required" | "unknown";
    assessorName: string;
  };
  evidence: {
    exterior: boolean;
    interior: boolean;
    controllerAndEquipment: boolean;
    panelsAndNameplates: boolean;
    powerAndGenerator: boolean;
    hubAndSensorLocations: boolean;
    hazardsAndWetAreas: boolean;
    notes: string;
  };
  decision: {
    desiredMode: DesiredMode;
    ownerAcknowledged: boolean;
    technicianConfirmed: boolean;
    notes: string;
  };
  completedAt: number;
}

export interface InstallationPlan {
  generatedAt: number;
  recommendedMode: "monitor" | "full_candidate";
  sections: number;
  nodeCount: number;
  metrics: string[];
  equipment: {
    id: string;
    kind: EquipmentKind;
    count: number;
    controlRequested: boolean;
  }[];
  connectivity: "local_only" | "cloud_sync";
  blockers: string[];
  controlRestrictions: string[];
}

export const installationChecks = [
  ["hubMounted", "Hub mounted at the approved location", false],
  ["antennaInstalled", "LoRa antenna installed and protected", false],
  ["nodesMounted", "All planned nodes mounted", false],
  ["nodeIdsConfirmed", "Node IDs match their planned locations", false],
  ["powerVerified", "Hub and node power sources verified", false],
  ["wiringCompleted", "Approved equipment wiring completed", true],
  ["differencesRecorded", "Differences from the plan recorded", false],
] as const;

export const commissioningChecks = [
  ["nodesOnline", "Every installed node is reporting", false],
  ["loraCoverage", "LoRa coverage passed at every location", false],
  ["localWifi", "Local WiFi works where staff use the app", false],
  [
    "readingsPlausible",
    "Sensor readings were compared and are plausible",
    false,
  ],
  [
    "sensorsCalibrated",
    "Required sensor warm-up and calibration completed",
    false,
  ],
  ["equipmentMapped", "Control nodes map to the approved equipment", true],
  ["actuatorTests", "Every approved equipment stage passed its test", true],
  ["fallbackTests", "Restart and communication-loss behavior passed", true],
  ["offlineOperation", "Local operation works without internet", false],
  ["syncRecovery", "Queued records synchronize after reconnection", false],
  ["alertsTested", "Local and remote alert paths were checked", false],
  ["backupReviewed", "Emergency power and response plan reviewed", false],
  ["ownerTrained", "Owner and workers received handover training", false],
] as const;

export const trialChecks = [
  [
    "readingsCompared",
    "Trial readings compared with reference instruments",
    false,
  ],
  ["alertsReviewed", "Trial alerts and suggested actions reviewed", false],
  ["thresholdsReviewed", "Site thresholds reviewed for the flock age", false],
  ["faultsResolved", "No unresolved safety or equipment fault remains", false],
] as const;

export type InstallationCheck = (typeof installationChecks)[number][0];
export type CommissioningCheck = (typeof commissioningChecks)[number][0];
export type TrialCheck = (typeof trialChecks)[number][0];

export interface SiteWorkflow {
  schemaVersion: 1;
  status: SiteStatus;
  survey: SiteSurvey | null;
  plan: InstallationPlan | null;
  installation: Record<InstallationCheck, ChecklistValue>;
  commissioning: Record<CommissioningCheck, ChecklistValue>;
  trial: Record<TrialCheck, ChecklistValue>;
  trialStartedAt: number | null;
  activatedMode: "monitor" | "full" | null;
  updatedAt: number;
}

const checklist = <T extends readonly (readonly [string, string, boolean])[]>(
  items: T,
) =>
  Object.fromEntries(items.map(([key]) => [key, "pending"])) as Record<
    T[number][0],
    ChecklistValue
  >;

export function emptySiteWorkflow(now = Date.now()): SiteWorkflow {
  return {
    schemaVersion: 1,
    status: "not_started",
    survey: null,
    plan: null,
    installation: checklist(installationChecks),
    commissioning: checklist(commissioningChecks),
    trial: checklist(trialChecks),
    trialStartedAt: null,
    activatedMode: null,
    updatedAt: now,
  };
}

export const equipmentKinds: { key: EquipmentKind; label: string }[] = [
  { key: "fan", label: "Fans" },
  { key: "heater", label: "Heaters" },
  { key: "light", label: "Lights" },
  { key: "cooling", label: "Cooling pads" },
  { key: "curtain", label: "Curtain motors" },
  { key: "pump", label: "Water pumps" },
  { key: "other", label: "Other equipment" },
];

export function emptyEquipment(
  kind: EquipmentKind,
  id = `equipment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
): SurveyEquipment {
  return {
    id,
    kind,
    count: 0,
    location: "",
    model: "",
    electricalRating: "",
    controlMethod: "unknown",
    condition: "unknown",
    stages: "",
    circuit: "",
    backupPower: "unknown",
    intendedControl: false,
    failureBehaviour: "",
  };
}

export function emptySiteSurvey(house?: HouseSurveyDraft | null): SiteSurvey {
  return {
    schemaVersion: 1,
    farm: {
      farmName: house?.farmName ?? "",
      houseName: house?.houseName ?? "",
      address: "",
      ownerName: "",
      ownerContact: "",
      visitDate: new Date().toISOString().slice(0, 10),
      technicianName: "",
      photoPermission: "unknown",
    },
    goals: {
      recurringProblems: "",
      currentDetection: "",
      currentResponse: "",
      recordsAvailable: "unknown",
    },
    flock: {
      type:
        house?.flock === "broiler" || house?.flock === "layer"
          ? house.flock
          : "unknown",
      breed: "",
      birdCount: 0,
      capacity: 0,
      startDate: "",
      cycleDays: 0,
      ageTargetsAvailable: "unknown",
    },
    house: {
      type: house?.houseType ?? "unknown",
      lengthMetres: house?.lengthMetres ?? 0,
      widthMetres: house?.widthMetres ?? 0,
      orientation: "",
      structureNotes: "",
      hotColdSpots: "",
      wetAreas: "",
      mountingNotes: "",
    },
    controller: {
      status: house?.controller ?? "unknown",
      brand: "",
      model: "",
      working: "unknown",
      ownerWantsRetained: "unknown",
      failureBehaviour: "",
    },
    equipment: [],
    power: {
      reliability: "unknown",
      outageHistory: "",
      longestOutage: "",
      backup: "unknown",
      backupDetails: "",
      poweredCircuits: "",
      powerLossProcedure: "",
      hubPowerLocation: "",
    },
    connectivity: {
      internet: "unknown",
      farmWifi: "unknown",
      routerLocation: "",
      hubLocation: "",
      antennaLocation: "",
      radioObstructions: "",
      phoneUseLocations: "",
      region: "",
    },
    sensors: {
      plannedNodes: 0,
      temperature: true,
      humidity: true,
      ammonia: false,
      co2: false,
      litterMoisture: false,
      microphone: false,
      placementNotes: "",
    },
    ai: {
      audioConsent: "unknown",
      microphoneLocations: "",
      noiseSources: "",
      observationRecorder: "",
      retentionNotes: "",
    },
    operations: {
      dayResponder: "",
      nightResponder: "",
      responseMinutes: 0,
      manualOperators: "",
      fanFailureProcedure: "",
      powerFailureProcedure: "",
      highGasProcedure: "",
    },
    safety: {
      wiring: "unknown",
      waterRisk: "unknown",
      hazards: "",
      electricalAssessment: "unknown",
      assessorName: "",
    },
    evidence: {
      exterior: false,
      interior: false,
      controllerAndEquipment: false,
      panelsAndNameplates: false,
      powerAndGenerator: false,
      hubAndSensorLocations: false,
      hazardsAndWetAreas: false,
      notes: "",
    },
    decision: {
      desiredMode: "undecided",
      ownerAcknowledged: false,
      technicianConfirmed: false,
      notes: "",
    },
    completedAt: 0,
  };
}

const clean = (value: string) => value.trim();
const hasText = (value: unknown, max = 2000) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const optionalText = (value: unknown, max = 2000) =>
  typeof value === "string" && value.length <= max;
const finiteRange = (value: unknown, min: number, max: number) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;

export function surveyMissing(s: SiteSurvey): string[] {
  const missing: string[] = [];
  if (!clean(s.farm.farmName)) missing.push("Farm name");
  if (!clean(s.farm.houseName)) missing.push("House name");
  if (!clean(s.farm.address)) missing.push("Farm address");
  if (!clean(s.farm.ownerName)) missing.push("Owner or farm contact");
  if (!clean(s.farm.visitDate)) missing.push("Visit date");
  if (!clean(s.farm.technicianName)) missing.push("Technician name");
  if (!clean(s.goals.recurringProblems))
    missing.push("Farm problems and objectives");
  if (s.house.lengthMetres <= 0 || s.house.widthMetres <= 0)
    missing.push("House dimensions");
  if (!clean(s.power.hubPowerLocation))
    missing.push("Candidate hub power location");
  if (!clean(s.connectivity.hubLocation))
    missing.push("Candidate hub location");
  if (!clean(s.connectivity.region))
    missing.push("Country or region for radio review");
  if (s.sensors.plannedNodes < 1) missing.push("Planned node count");
  if (
    !s.sensors.temperature &&
    !s.sensors.humidity &&
    !s.sensors.ammonia &&
    !s.sensors.co2 &&
    !s.sensors.litterMoisture
  )
    missing.push("At least one environmental measurement");
  if (!clean(s.operations.dayResponder)) missing.push("Daytime responder");
  if (!clean(s.operations.powerFailureProcedure))
    missing.push("Power-loss response");
  if (!s.decision.ownerAcknowledged) missing.push("Owner acknowledgement");
  if (!s.decision.technicianConfirmed) missing.push("Technician confirmation");
  return missing;
}

export function buildInstallationPlan(
  s: SiteSurvey,
  now = Date.now(),
): InstallationPlan {
  const blockers: string[] = [];
  const restrictions: string[] = [];
  if (s.safety.wiring === "damaged")
    blockers.push("Visible wiring damage must be resolved.");
  if (s.connectivity.hubLocation.trim() === "")
    blockers.push("Confirm a safe hub location.");
  if (s.power.hubPowerLocation.trim() === "")
    blockers.push("Confirm reliable power for the hub.");
  if (s.sensors.plannedNodes < 1)
    blockers.push("Plan at least one sensing node.");
  if (s.house.type === "unknown" || s.house.type === "mixed")
    restrictions.push(
      "House type needs project review; automatic control is unavailable.",
    );
  if (s.controller.status !== "absent")
    restrictions.push(
      "An existing or unknown controller keeps the house monitor-only.",
    );
  const controlEquipment = s.equipment.filter(
    (e) => e.count > 0 && e.intendedControl,
  );
  if (!controlEquipment.length)
    restrictions.push("No equipment is approved for CoopGuard control.");
  if (
    controlEquipment.some(
      (item) =>
        item.condition !== "working" ||
        !item.location.trim() ||
        !item.model.trim() ||
        !item.electricalRating.trim() ||
        !item.stages.trim() ||
        !item.circuit.trim() ||
        !item.failureBehaviour.trim(),
    )
  )
    restrictions.push(
      "Controlled equipment details or safe fallback behavior are incomplete.",
    );
  if (
    controlEquipment.length > 0 &&
    (s.farm.photoPermission !== "yes" ||
      !s.evidence.controllerAndEquipment ||
      !s.evidence.panelsAndNameplates ||
      !s.evidence.powerAndGenerator ||
      !s.evidence.hubAndSensorLocations ||
      !s.evidence.hazardsAndWetAreas)
  )
    restrictions.push("Required control-planning evidence is incomplete.");
  if (s.safety.electricalAssessment !== "approved")
    restrictions.push("Electrical control interface has not been approved.");
  if (s.safety.wiring !== "appears_safe")
    restrictions.push("Wiring condition has not been verified as suitable.");
  if (s.house.type === "tunnel" && s.power.backup !== "yes")
    restrictions.push(
      "Tunnel-house emergency ventilation power is not verified.",
    );
  if (s.decision.desiredMode !== "control")
    restrictions.push(
      "The recorded operating preference is monitoring or undecided.",
    );
  const metrics = [
    s.sensors.temperature && "Temperature",
    s.sensors.humidity && "Humidity",
    s.sensors.ammonia && "Ammonia",
    s.sensors.co2 && "Carbon dioxide",
    s.sensors.litterMoisture && "Litter moisture",
    s.sensors.microphone && s.ai.audioConsent === "yes" && "Sound collection",
  ].filter((v): v is string => !!v);
  return {
    generatedAt: now,
    recommendedMode: restrictions.length === 0 ? "full_candidate" : "monitor",
    sections: Math.max(
      1,
      Math.ceil(Math.max(s.house.lengthMetres, s.house.widthMetres) / 30),
    ),
    nodeCount: s.sensors.plannedNodes,
    metrics,
    equipment: s.equipment
      .filter((e) => e.count > 0)
      .map((e) => ({
        id: e.id,
        kind: e.kind,
        count: e.count,
        controlRequested: e.intendedControl,
      })),
    connectivity:
      s.connectivity.internet === "yes" ? "cloud_sync" : "local_only",
    blockers,
    controlRestrictions: restrictions,
  };
}

export function workflowFromSurvey(
  survey: SiteSurvey,
  now = Date.now(),
): SiteWorkflow {
  return {
    ...emptySiteWorkflow(now),
    status: "review_required",
    survey: { ...survey, completedAt: now },
    plan: buildInstallationPlan(survey, now),
    updatedAt: now,
  };
}

export function workflowFromLegacyHouse(
  house: HouseSurveyDraft,
  now = Date.now(),
): SiteWorkflow {
  void house;
  return emptySiteWorkflow(now);
}

export function checklistComplete<K extends string>(
  values: Record<K, ChecklistValue>,
  definitions: readonly (readonly [K, string, boolean])[],
) {
  return definitions.every(([key, _label, allowNa]) =>
    allowNa
      ? values[key] === "passed" || values[key] === "na"
      : values[key] === "passed",
  );
}

export function siteStatusLabel(status: SiteStatus) {
  return {
    not_started: "Survey required",
    review_required: "Technical review required",
    approved_install: "Approved for installation",
    installing: "Installation in progress",
    commissioning: "Commissioning in progress",
    monitoring_trial: "Monitoring trial",
    normal_monitor: "Normal · monitor-only",
    normal_control: "Normal · full control",
  }[status];
}

export function enabledMetrics(site: SiteWorkflow): MetricKey[] {
  if (!site.survey)
    return ["temperature", "humidity", "ammonia", "co2", "moisture"];
  const selected: MetricKey[] = [];
  if (site.survey.sensors.temperature) selected.push("temperature");
  if (site.survey.sensors.humidity) selected.push("humidity");
  if (site.survey.sensors.ammonia) selected.push("ammonia");
  if (site.survey.sensors.co2) selected.push("co2");
  if (site.survey.sensors.litterMoisture) selected.push("moisture");
  return selected;
}

export function validSiteSurvey(value: unknown): value is SiteSurvey {
  try {
    const s = value as SiteSurvey;
    const answer = (v: unknown) => ["yes", "no", "unknown"].includes(String(v));
    return (
      !!s &&
      s.schemaVersion === 1 &&
      hasText(s.farm.farmName, 80) &&
      hasText(s.farm.houseName, 80) &&
      hasText(s.farm.address, 300) &&
      hasText(s.farm.ownerName, 80) &&
      optionalText(s.farm.ownerContact, 80) &&
      /^\d{4}-\d{2}-\d{2}$/.test(s.farm.visitDate) &&
      hasText(s.farm.technicianName, 80) &&
      answer(s.farm.photoPermission) &&
      hasText(s.goals.recurringProblems) &&
      optionalText(s.goals.currentDetection) &&
      optionalText(s.goals.currentResponse) &&
      answer(s.goals.recordsAvailable) &&
      ["broiler", "layer", "breeder", "other", "unknown"].includes(
        s.flock.type,
      ) &&
      optionalText(s.flock.breed, 80) &&
      finiteRange(s.flock.birdCount, 0, 1_000_000) &&
      finiteRange(s.flock.capacity, 0, 1_000_000) &&
      optionalText(s.flock.startDate, 10) &&
      finiteRange(s.flock.cycleDays, 0, 730) &&
      answer(s.flock.ageTargetsAvailable) &&
      ["open", "tunnel", "mixed", "unknown"].includes(s.house.type) &&
      finiteRange(s.house.lengthMetres, 0.1, 1000) &&
      finiteRange(s.house.widthMetres, 0.1, 1000) &&
      optionalText(s.house.orientation, 100) &&
      optionalText(s.house.structureNotes) &&
      optionalText(s.house.hotColdSpots) &&
      optionalText(s.house.wetAreas) &&
      optionalText(s.house.mountingNotes) &&
      ["present", "absent", "unknown"].includes(s.controller.status) &&
      optionalText(s.controller.brand, 80) &&
      optionalText(s.controller.model, 80) &&
      answer(s.controller.working) &&
      answer(s.controller.ownerWantsRetained) &&
      optionalText(s.controller.failureBehaviour) &&
      Array.isArray(s.equipment) &&
      s.equipment.length <= 100 &&
      new Set(s.equipment.map((e) => e.id)).size === s.equipment.length &&
      s.equipment.every(
        (e) =>
          hasText(e.id, 100) &&
          equipmentKinds.some((k) => k.key === e.kind) &&
          Number.isInteger(e.count) &&
          e.count >= 0 &&
          e.count <= 1000 &&
          optionalText(e.location, 300) &&
          optionalText(e.model, 160) &&
          optionalText(e.electricalRating, 160) &&
          ["manual", "automatic", "both", "unknown"].includes(
            e.controlMethod,
          ) &&
          ["working", "damaged", "intermittent", "unknown"].includes(
            e.condition,
          ) &&
          optionalText(e.stages, 160) &&
          optionalText(e.circuit, 160) &&
          answer(e.backupPower) &&
          typeof e.intendedControl === "boolean" &&
          optionalText(e.failureBehaviour),
      ) &&
      ["reliable", "unstable", "unknown"].includes(s.power.reliability) &&
      optionalText(s.power.outageHistory) &&
      optionalText(s.power.longestOutage, 160) &&
      answer(s.power.backup) &&
      optionalText(s.power.backupDetails) &&
      optionalText(s.power.poweredCircuits) &&
      hasText(s.power.powerLossProcedure) &&
      hasText(s.power.hubPowerLocation, 300) &&
      answer(s.connectivity.internet) &&
      answer(s.connectivity.farmWifi) &&
      optionalText(s.connectivity.routerLocation, 300) &&
      hasText(s.connectivity.hubLocation, 300) &&
      optionalText(s.connectivity.antennaLocation, 300) &&
      optionalText(s.connectivity.radioObstructions) &&
      optionalText(s.connectivity.phoneUseLocations) &&
      hasText(s.connectivity.region, 100) &&
      Number.isInteger(s.sensors.plannedNodes) &&
      s.sensors.plannedNodes >= 1 &&
      s.sensors.plannedNodes <= 1000 &&
      [
        "temperature",
        "humidity",
        "ammonia",
        "co2",
        "litterMoisture",
        "microphone",
      ].every(
        (key) => typeof s.sensors[key as keyof typeof s.sensors] === "boolean",
      ) &&
      optionalText(s.sensors.placementNotes) &&
      answer(s.ai.audioConsent) &&
      optionalText(s.ai.microphoneLocations) &&
      optionalText(s.ai.noiseSources) &&
      optionalText(s.ai.observationRecorder, 160) &&
      optionalText(s.ai.retentionNotes) &&
      hasText(s.operations.dayResponder, 160) &&
      optionalText(s.operations.nightResponder, 160) &&
      finiteRange(s.operations.responseMinutes, 0, 1440) &&
      optionalText(s.operations.manualOperators) &&
      optionalText(s.operations.fanFailureProcedure) &&
      hasText(s.operations.powerFailureProcedure) &&
      optionalText(s.operations.highGasProcedure) &&
      ["appears_safe", "damaged", "unknown"].includes(s.safety.wiring) &&
      answer(s.safety.waterRisk) &&
      optionalText(s.safety.hazards) &&
      ["approved", "required", "not_required", "unknown"].includes(
        s.safety.electricalAssessment,
      ) &&
      optionalText(s.safety.assessorName, 160) &&
      Object.entries(s.evidence)
        .filter(([key]) => key !== "notes")
        .every(([, v]) => typeof v === "boolean") &&
      optionalText(s.evidence.notes) &&
      ["monitor", "control", "undecided"].includes(s.decision.desiredMode) &&
      typeof s.decision.ownerAcknowledged === "boolean" &&
      typeof s.decision.technicianConfirmed === "boolean" &&
      optionalText(s.decision.notes) &&
      finiteRange(s.completedAt, 0, Number.MAX_SAFE_INTEGER) &&
      surveyMissing(s).length === 0
    );
  } catch {
    return false;
  }
}

export function validSiteWorkflow(value: unknown): value is SiteWorkflow {
  try {
    const s = value as SiteWorkflow;
    const status: SiteStatus[] = [
      "not_started",
      "review_required",
      "approved_install",
      "installing",
      "commissioning",
      "monitoring_trial",
      "normal_monitor",
      "normal_control",
    ];
    const validChecks = <K extends string>(
      values: Record<K, ChecklistValue>,
      defs: readonly (readonly [K, string, boolean])[],
    ) =>
      !!values &&
      defs.every(([key, _label, allowNa]) =>
        allowNa
          ? ["pending", "passed", "na"].includes(values[key])
          : ["pending", "passed"].includes(values[key]),
      );
    return (
      !!s &&
      s.schemaVersion === 1 &&
      status.includes(s.status) &&
      ((s.survey === null && s.status === "not_started" && s.plan === null) ||
        (validSiteSurvey(s.survey) &&
          !!s.plan &&
          ["monitor", "full_candidate"].includes(s.plan.recommendedMode) &&
          Array.isArray(s.plan.blockers) &&
          Array.isArray(s.plan.controlRestrictions))) &&
      validChecks(s.installation, installationChecks) &&
      validChecks(s.commissioning, commissioningChecks) &&
      validChecks(s.trial, trialChecks) &&
      (s.trialStartedAt === null ||
        finiteRange(s.trialStartedAt, 0, Number.MAX_SAFE_INTEGER)) &&
      (s.activatedMode === null ||
        ["monitor", "full"].includes(s.activatedMode)) &&
      finiteRange(s.updatedAt, 0, Number.MAX_SAFE_INTEGER)
    );
  } catch {
    return false;
  }
}
