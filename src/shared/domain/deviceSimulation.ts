import type { SiteWorkflow } from "./siteWorkflow";

export type VirtualNodeProfile = "climate" | "air_quality" | "sound" | "control";
export type VirtualDeviceStatus = "created" | "paired" | "reporting";

export interface VirtualHub {
  id: string;
  farmCode: string;
  pairingCode: string;
  status: VirtualDeviceStatus;
  createdAt: number;
  pairedAt?: number;
}

export interface VirtualNode {
  id: string;
  farmCode: string;
  pairingCode: string;
  profile: VirtualNodeProfile;
  section: "A" | "B" | "C";
  status: VirtualDeviceStatus;
  createdAt: number;
  pairedAt?: number;
  hubId?: string;
}

export interface DeviceSimulation {
  enabled: true;
  hub: VirtualHub | null;
  nodes: VirtualNode[];
}

export interface DeviceSetupProgress {
  ready: boolean;
  requiredNodes: number;
  reportingNodes: number;
  missing: string[];
}

export const nodeProfileLabels: Record<VirtualNodeProfile, string> = {
  climate: "Climate sensors",
  air_quality: "Air-quality sensors",
  sound: "Sound collection",
  control: "Equipment control",
};

export function emptyDeviceSimulation(): DeviceSimulation {
  return { enabled: true, hub: null, nodes: [] };
}

export function requiredNodeProfiles(site: SiteWorkflow): VirtualNodeProfile[] {
  const survey = site.survey;
  if (!survey) return [];
  const profiles: VirtualNodeProfile[] = [];
  if (survey.sensors.temperature || survey.sensors.humidity || survey.sensors.litterMoisture)
    profiles.push("climate");
  if (survey.sensors.ammonia || survey.sensors.co2) profiles.push("air_quality");
  if (survey.sensors.microphone && survey.ai.audioConsent === "yes") profiles.push("sound");
  if (survey.equipment.some((item) => item.count > 0 && item.intendedControl))
    profiles.push("control");
  return profiles;
}

export function deviceSetupProgress(
  site: SiteWorkflow,
  simulation: DeviceSimulation,
): DeviceSetupProgress {
  const missing: string[] = [];
  if (!site.survey || !site.plan) missing.push("Complete the house survey and generate its plan.");
  if (!simulation.hub || simulation.hub.status !== "reporting")
    missing.push("Pair a virtual hub and confirm its heartbeat.");
  const reporting = simulation.nodes.filter((node) => node.status === "reporting");
  const requiredNodes = Math.max(site.plan?.nodeCount ?? 0, requiredNodeProfiles(site).length);
  if (reporting.length < requiredNodes)
    missing.push(`Pair ${requiredNodes - reporting.length} more reporting node(s).`);
  for (const profile of requiredNodeProfiles(site)) {
    if (!reporting.some((node) => node.profile === profile))
      missing.push(`Add a reporting ${nodeProfileLabels[profile].toLowerCase()} node.`);
  }
  return { ready: missing.length === 0, requiredNodes, reportingNodes: reporting.length, missing };
}

type PairingPayload =
  | { version: 1; kind: "hub"; farmCode: string; deviceId: string; pairingCode: string }
  | {
      version: 1;
      kind: "node";
      farmCode: string;
      deviceId: string;
      pairingCode: string;
      profile: VirtualNodeProfile;
    };

export function pairingQr(payload: PairingPayload) {
  const params = new URLSearchParams({
    version: String(payload.version),
    farm: payload.farmCode,
    device: payload.deviceId,
    code: payload.pairingCode,
    ...(payload.kind === "node" ? { profile: payload.profile } : {}),
  });
  return `coopguard://${payload.kind}/pair?${params.toString()}`;
}

export function farmQr(farmCode: string) {
  if (!/^CG-[A-Z0-9-]{4,32}$/.test(farmCode)) throw new Error("The Farm ID is invalid.");
  return `coopguard://farm/open?version=1&farm=${encodeURIComponent(farmCode)}`;
}

export function parsePairingQr(value: string): PairingPayload {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("This is not a CoopGuard pairing QR code.");
  }
  const kind = url.hostname;
  const farmCode = url.searchParams.get("farm") ?? "";
  const deviceId = url.searchParams.get("device") ?? "";
  const pairingCode = url.searchParams.get("code") ?? "";
  if (
    url.protocol !== "coopguard:" ||
    url.pathname !== "/pair" ||
    (kind !== "hub" && kind !== "node") ||
    url.searchParams.get("version") !== "1" ||
    !/^CG-[A-Z0-9-]{4,32}$/.test(farmCode) ||
    !/^(HUB|NODE)-[A-Z0-9]{6,16}$/.test(deviceId) ||
    !/^[A-Z0-9]{10,40}$/.test(pairingCode)
  )
    throw new Error("This CoopGuard QR code is incomplete or invalid.");
  if (kind === "hub") return { version: 1, kind, farmCode, deviceId, pairingCode };
  const profile = url.searchParams.get("profile") as VirtualNodeProfile;
  if (!Object.hasOwn(nodeProfileLabels, profile)) throw new Error("The node profile is invalid.");
  return { version: 1, kind, farmCode, deviceId, pairingCode, profile };
}

export function validDeviceSimulation(value: unknown): value is DeviceSimulation {
  try {
    const simulation = value as DeviceSimulation;
    const statuses = ["created", "paired", "reporting"];
    const validBase = (item: VirtualHub | VirtualNode) =>
      /^(HUB|NODE)-[A-Z0-9]{6,16}$/.test(item.id) &&
      /^CG-[A-Z0-9-]{4,32}$/.test(item.farmCode) &&
      /^[A-Z0-9]{10,40}$/.test(item.pairingCode) &&
      statuses.includes(item.status) &&
      Number.isFinite(item.createdAt) &&
      (item.pairedAt === undefined || Number.isFinite(item.pairedAt));
    return (
      !!simulation &&
      simulation.enabled === true &&
      (simulation.hub === null ||
        (validBase(simulation.hub) && simulation.hub.id.startsWith("HUB-"))) &&
      Array.isArray(simulation.nodes) &&
      simulation.nodes.length <= 1000 &&
      new Set(simulation.nodes.map((node) => node.id)).size === simulation.nodes.length &&
      simulation.nodes.every(
        (node) =>
          validBase(node) &&
          node.id.startsWith("NODE-") &&
          Object.hasOwn(nodeProfileLabels, node.profile) &&
          ["A", "B", "C"].includes(node.section) &&
          (node.hubId === undefined || /^HUB-[A-Z0-9]{6,16}$/.test(node.hubId)),
      )
    );
  } catch {
    return false;
  }
}
