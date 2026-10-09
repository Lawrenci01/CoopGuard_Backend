import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { CoopDatabase, SqlRow } from "./database";
import { houseGrid, positionInSection } from "./shared/domain/houseLayout";
import type { LocalFarmState } from "./shared/services/localFarmRepository";
import type { Section } from "./shared/domain/types";
import { telemetrySecretDigest, validTelemetrySecret } from "./telemetry";

const httpsUrl = z
  .url()
  .refine(
    (value) => new URL(value).protocol === "https:",
    "Hub endpoints must use HTTPS.",
  )
  .transform((value) => new URL(value).origin);

const hotspotSchema = z
  .object({
    ssid: z.string().trim().min(1).max(32),
    passphrase: z.string().min(8).max(63),
  })
  .strict();

const hubQrSchema = z
  .object({
    type: z.literal("coopguard-hub"),
    version: z.literal(1),
    hubId: z.string().regex(/^HUB-[A-Z0-9-]{6,48}$/),
    token: z.string().min(32).max(256),
    wifiUrl: httpsUrl,
    usbUrl: httpsUrl,
    hotspot: hotspotSchema.optional(),
    expiresAt: z.number().int().positive(),
  })
  .strict();

export type HubPairingQr = z.infer<typeof hubQrSchema>;

export interface HubPrivateConfig {
  schemaVersion: 1;
  hubId: string;
  hubSecret: string;
  farmCode?: string;
  nodes: { id: string; number: string; section: Section }[];
}

type HubEndpoints = {
  wifiUrl: string;
  usbUrl: string;
  hotspot?: { ssid: string; passphrase: string };
};

function pairingQr(
  hubId: string,
  token: string,
  endpoints: HubEndpoints,
  expiresAt: number,
): HubPairingQr {
  return {
    type: "coopguard-hub",
    version: 1,
    hubId,
    token,
    wifiUrl: httpsUrl.parse(endpoints.wifiUrl),
    usbUrl: httpsUrl.parse(endpoints.usbUrl),
    ...(endpoints.hotspot
      ? { hotspot: hotspotSchema.parse(endpoints.hotspot) }
      : {}),
    expiresAt,
  };
}

export function parseHubPairingQr(value: string): HubPairingQr {
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    throw new Error("This is not a CoopGuard hub pairing QR code.");
  }
  const parsed = hubQrSchema.safeParse(raw);
  if (!parsed.success)
    throw new Error(
      "This CoopGuard hub pairing QR code is incomplete or invalid.",
    );
  return parsed.data;
}

export async function createHubPairing(
  db: CoopDatabase,
  endpoints: HubEndpoints,
  now = Date.now(),
  lifetimeMs = 15 * 60_000,
) {
  const hubId = `HUB-${randomBytes(6).toString("hex").toUpperCase()}`;
  const token = randomBytes(32).toString("base64url");
  const hubSecret = randomBytes(32).toString("base64url");
  const pairingId = randomUUID();
  const qr = pairingQr(hubId, token, endpoints, now + lifetimeMs);
  await db
    .prepare(
      `INSERT INTO hub_pairings(id,hub_id,token_digest,secret_digest,wifi_url,usb_url,status,expires_at,created_at)
       VALUES(?,?,?,?,?,?,'pending',?,?)`,
    )
    .run(
      pairingId,
      hubId,
      telemetrySecretDigest(token),
      telemetrySecretDigest(hubSecret),
      qr.wifiUrl,
      qr.usbUrl,
      qr.expiresAt,
      now,
    );
  return {
    pairingId,
    qr: JSON.stringify(qr),
    config: {
      schemaVersion: 1,
      hubId,
      hubSecret,
      nodes: [],
    } satisfies HubPrivateConfig,
  };
}

export async function refreshHubPairing(
  db: CoopDatabase,
  config: HubPrivateConfig,
  endpoints: HubEndpoints,
  now = Date.now(),
  lifetimeMs = 15 * 60_000,
) {
  const token = randomBytes(32).toString("base64url");
  const qr = pairingQr(config.hubId, token, endpoints, now + lifetimeMs);
  const pairing = await db
    .prepare("SELECT id,status FROM hub_pairings WHERE hub_id=?")
    .get(config.hubId);
  if (!pairing)
    throw new Error(
      "This saved hub identity is missing from the synchronized database. Run hub:create with --new-identity to replace it.",
    );
  if (pairing.status === "replacement_pending")
    throw new Error(
      "This hub is awaiting administrator replacement approval. Use its current QR instead of refreshing it.",
    );
  await db
    .prepare(
      `UPDATE hub_pairings
       SET token_digest=?,secret_digest=?,wifi_url=?,usb_url=?,status='pending',farm_id=NULL,requested_by=NULL,expires_at=?,created_at=?,claimed_at=NULL
       WHERE hub_id=?`,
    )
    .run(
      telemetrySecretDigest(token),
      telemetrySecretDigest(config.hubSecret),
      qr.wifiUrl,
      qr.usbUrl,
      qr.expiresAt,
      now,
      config.hubId,
    );
  return {
    pairingId: String(pairing.id),
    qr: JSON.stringify(qr),
    config,
  };
}

type PlannedNode = {
  id: string;
  number: string;
  section: Section;
  x: number;
  y: number;
};

function plannedNodes(state: LocalFarmState, hubId: string): PlannedNode[] {
  const house = state.site.survey?.house ?? state.house;
  const grid = houseGrid(house?.lengthMetres ?? 90, house?.widthMetres ?? 12);
  const virtual = state.deviceSimulation?.nodes ?? [];
  if (virtual.length)
    return virtual.map((node, index) => {
      const peers = virtual.filter((item) => item.section === node.section);
      const fallback = positionInSection(
        node.section,
        grid,
        peers.findIndex((item) => item.id === node.id),
        peers.length,
      );
      return {
        id: `${hubId}-N${String(index + 1).padStart(2, "0")}`,
        number: String(index + 1).padStart(2, "0"),
        section: node.section,
        x: node.x ?? fallback.x,
        y: node.y ?? fallback.y,
      };
    });
  const count = Math.max(1, state.site.plan?.nodeCount ?? grid.count);
  return Array.from({ length: count }, (_, index) => {
    const section = grid.sections[index % grid.sections.length]!;
    const peers = Math.ceil(
      (count - (index % grid.sections.length)) / grid.sections.length,
    );
    const position = Math.floor(index / grid.sections.length);
    const placement = positionInSection(section, grid, position, peers);
    return {
      id: `${hubId}-N${String(index + 1).padStart(2, "0")}`,
      number: String(index + 1).padStart(2, "0"),
      section,
      ...placement,
    };
  });
}

async function farmPlan(db: CoopDatabase, farmId: string) {
  const farm = (await db
    .prepare(
      "SELECT f.id,f.state,c.code FROM farms f JOIN farm_codes c ON c.farm_id=f.id WHERE f.id=?",
    )
    .get(farmId)) as { id: string; state: string; code: string } | undefined;
  if (!farm)
    throw Object.assign(new Error("Farm not found."), { statusCode: 404 });
  const state = JSON.parse(farm.state) as LocalFarmState;
  return { ...farm, nodes: plannedNodes(state, "") };
}

async function activationStatements(
  db: CoopDatabase,
  pairing: SqlRow,
  farmId: string,
  now: number,
) {
  const farm = await farmPlan(db, farmId);
  const hubId = String(pairing.hub_id);
  // Hub registration and node registration are separate commissioning steps.
  // Nodes are created only when the technician explicitly identifies them.
  const nodes: PlannedNode[] = [];
  return {
    farmCode: farm.code,
    nodes,
    statements: [
      {
        sql: "INSERT INTO telemetry_hubs(id,farm_id,secret_digest,active,source,created_at,last_seen_at) VALUES(?,?,?,1,'simulated',?,NULL)",
        args: [hubId, farmId, String(pairing.secret_digest), now],
      },
    ],
  };
}

export async function claimHub(
  db: CoopDatabase,
  qrValue: string,
  farmId: string,
  technicianId: string,
  now = Date.now(),
) {
  const qr = parseHubPairingQr(qrValue);
  const pairing = await db
    .prepare("SELECT * FROM hub_pairings WHERE hub_id=?")
    .get(qr.hubId);
  if (!pairing || !validTelemetrySecret(qr.token, String(pairing.token_digest)))
    throw Object.assign(new Error("This hub pairing code is not valid."), {
      statusCode: 401,
    });
  if (pairing.status === "claimed" && pairing.farm_id === farmId) {
    const plan = await activationStatements(db, pairing, farmId, now);
    return {
      status: "claimed" as const,
      hubId: qr.hubId,
      farmCode: plan.farmCode,
      nodes: plan.nodes,
    };
  }
  if (pairing.status === "replacement_pending" && pairing.farm_id === farmId) {
    const replacement = await db
      .prepare(
        "SELECT id FROM hub_replacement_requests WHERE pairing_id=? AND status='pending'",
      )
      .get(pairing.id as string);
    if (replacement)
      return {
        status: "replacement_pending" as const,
        hubId: qr.hubId,
        requestId: String(replacement.id),
      };
  }
  if (Number(pairing.expires_at) < now) {
    await db
      .prepare("UPDATE hub_pairings SET status='expired' WHERE id=?")
      .run(pairing.id as string);
    throw Object.assign(
      new Error(
        "This hub pairing code has expired. Create a new code on the laptop.",
      ),
      {
        statusCode: 410,
      },
    );
  }
  if (pairing.status !== "pending")
    throw Object.assign(
      new Error("This hub pairing code has already been used."),
      { statusCode: 409 },
    );
  const existing = await db
    .prepare("SELECT id FROM telemetry_hubs WHERE farm_id=? AND active=1")
    .get(farmId);
  if (existing?.id === qr.hubId) {
    const farm = await farmPlan(db, farmId);
    await db.batch([
      {
        sql: "UPDATE telemetry_hubs SET secret_digest=? WHERE id=? AND farm_id=? AND active=1",
        args: [String(pairing.secret_digest), qr.hubId, farmId],
      },
      {
        sql: "UPDATE hub_pairings SET status='claimed',farm_id=?,requested_by=?,claimed_at=? WHERE id=?",
        args: [farmId, technicianId, now, pairing.id as string],
      },
    ]);
    return {
      status: "claimed" as const,
      hubId: qr.hubId,
      farmCode: farm.code,
      nodes: [] as PlannedNode[],
    };
  }
  if (existing) {
    const requestId = randomUUID();
    await db.batch([
      {
        sql: "UPDATE hub_pairings SET status='replacement_pending',farm_id=?,requested_by=? WHERE id=?",
        args: [farmId, technicianId, pairing.id as string],
      },
      {
        sql: "INSERT INTO hub_replacement_requests(id,pairing_id,farm_id,old_hub_id,requested_by,status,created_at) VALUES(?,?,?,?,?,'pending',?)",
        args: [
          requestId,
          pairing.id as string,
          farmId,
          existing.id as string,
          technicianId,
          now,
        ],
      },
    ]);
    return {
      status: "replacement_pending" as const,
      hubId: qr.hubId,
      requestId,
    };
  }
  const plan = await activationStatements(db, pairing, farmId, now);
  await db.batch([
    ...plan.statements,
    {
      sql: "UPDATE hub_pairings SET status='claimed',farm_id=?,requested_by=?,claimed_at=? WHERE id=?",
      args: [farmId, technicianId, now, pairing.id as string],
    },
  ]);
  return {
    status: "claimed" as const,
    hubId: qr.hubId,
    farmCode: plan.farmCode,
    nodes: plan.nodes,
  };
}

export async function replacementRequests(db: CoopDatabase) {
  return db
    .prepare(
      `SELECT r.id,r.farm_id farmId,f.name farmName,c.code farmCode,r.old_hub_id oldHubId,
              p.hub_id newHubId,r.status,r.created_at createdAt,u.name requestedBy
       FROM hub_replacement_requests r
       JOIN hub_pairings p ON p.id=r.pairing_id
       JOIN farms f ON f.id=r.farm_id JOIN farm_codes c ON c.farm_id=f.id
       JOIN users u ON u.id=r.requested_by
       ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END,r.created_at DESC`,
    )
    .all();
}

export async function reviewReplacement(
  db: CoopDatabase,
  requestId: string,
  adminId: string,
  decision: "approve" | "reject",
  now = Date.now(),
) {
  const request = await db
    .prepare(
      `SELECT r.*,p.hub_id,p.secret_digest,p.id pairing_id_value
       FROM hub_replacement_requests r JOIN hub_pairings p ON p.id=r.pairing_id WHERE r.id=?`,
    )
    .get(requestId);
  if (!request)
    throw Object.assign(new Error("Replacement request not found."), {
      statusCode: 404,
    });
  if (request.status !== "pending")
    throw Object.assign(
      new Error("This replacement request has already been reviewed."),
      { statusCode: 409 },
    );
  if (decision === "reject") {
    await db.batch([
      {
        sql: "UPDATE hub_replacement_requests SET status='rejected',reviewed_by=?,reviewed_at=? WHERE id=?",
        args: [adminId, now, requestId],
      },
      {
        sql: "UPDATE hub_pairings SET status='cancelled' WHERE id=?",
        args: [request.pairing_id as string],
      },
    ]);
    return { status: "rejected" as const };
  }
  const plan = await activationStatements(
    db,
    request,
    String(request.farm_id),
    now,
  );
  await db.batch([
    {
      sql: "UPDATE telemetry_hubs SET active=0 WHERE farm_id=? AND active=1",
      args: [request.farm_id as string],
    },
    {
      sql: "UPDATE telemetry_nodes SET active=0 WHERE farm_id=? AND active=1",
      args: [request.farm_id as string],
    },
    ...plan.statements,
    {
      sql: "UPDATE hub_replacement_requests SET status='approved',reviewed_by=?,reviewed_at=? WHERE id=?",
      args: [adminId, now, requestId],
    },
    {
      sql: "UPDATE hub_pairings SET status='claimed',claimed_at=? WHERE id=?",
      args: [now, request.pairing_id as string],
    },
  ]);
  return {
    status: "approved" as const,
    hubId: String(request.hub_id),
    farmCode: plan.farmCode,
    nodes: plan.nodes,
  };
}

export async function hubBootstrap(
  db: CoopDatabase,
  hubId: string,
  secret: string,
) {
  const hub = await db
    .prepare(
      `SELECT h.id,h.secret_digest,c.code farmCode,f.name farmName
       FROM telemetry_hubs h JOIN farms f ON f.id=h.farm_id JOIN farm_codes c ON c.farm_id=f.id
       WHERE h.id=? AND h.active=1`,
    )
    .get(hubId);
  if (!hub || !validTelemetrySecret(secret, String(hub.secret_digest)))
    throw Object.assign(new Error("Valid hub credentials are required."), {
      statusCode: 401,
    });
  const nodes = await db
    .prepare(
      "SELECT id,number,section FROM telemetry_nodes WHERE hub_id=? AND active=1 ORDER BY number",
    )
    .all(hubId);
  return {
    hubId,
    farmCode: String(hub.farmCode),
    farmName: String(hub.farmName),
    nodes: nodes.map((node) => ({
      id: String(node.id),
      number: String(node.number),
      section: String(node.section),
    })),
  };
}
