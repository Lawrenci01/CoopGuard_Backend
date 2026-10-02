import { z } from "zod";
import { validSiteSurvey } from "./shared/domain/siteWorkflow";

export const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9][a-z0-9._-]{2,39}$/,
    "Use 3–40 letters, numbers, dots, underscores or hyphens.",
  );
export const password = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128);
export const name = z.string().trim().min(1).max(80);
const id = z.string().min(1).max(100);
const section = z.enum(["A", "B", "C"]);
const simple = (type: string) => z.object({ type: z.literal(type) }).strict();
export const actionSchema = z.discriminatedUnion("type", [
  simple("fullPower"),
  simple("endFlock"),
  simple("refresh"),
  z.object({ type: z.literal("ack"), id }).strict(),
  z
    .object({
      type: z.literal("house"),
      value: z
        .object({
          farmName: name,
          houseName: name,
          houseType: z.enum(["open", "tunnel", "unknown"]),
          controller: z.enum(["present", "absent", "unknown"]),
          flock: z.enum(["broiler", "layer", "unknown"]),
          lengthMetres: z.number().positive().max(1000),
          widthMetres: z.number().positive().max(1000),
        })
        .strict(),
      open: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("startFlock"),
      startDate: z.string().max(10),
      days: z.number().int().positive().max(730),
      birds: z.number().int().positive().max(1_000_000),
    })
    .strict(),
  z
    .object({
      type: z.literal("saveInspection"),
      id: id.optional(),
      kind: z.enum(["environment", "sound"]),
      text: z.string().trim().min(1).max(2000),
    })
    .strict(),
  z.object({ type: z.literal("deleteInspection"), id }).strict(),
  z
    .object({
      type: z.literal("addSensor"),
      section,
      control: z.boolean(),
      tested: z.boolean(),
      calibrated: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal("moveSensor"),
      id,
      section,
      x: z.number().min(0.05).max(0.95),
      y: z.number().min(0.1).max(0.9),
    })
    .strict(),
  z.object({ type: z.literal("retireSensor"), id }).strict(),
  z.object({ type: z.literal("calibrate"), id }).strict(),
  z
    .object({
      type: z.literal("saveSiteSurvey"),
      value: z.custom(
        validSiteSurvey,
        "Complete the required survey questions.",
      ),
    })
    .strict(),
  simple("approveSitePlan"),
  simple("startInstallation"),
  simple("beginCommissioning"),
  simple("startMonitoringTrial"),
  z
    .object({
      type: z.literal("siteChecklist"),
      stage: z.enum(["installation", "commissioning", "trial"]),
      key: id,
      value: z.enum(["pending", "passed", "na"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("activateSite"),
      mode: z.enum(["monitor", "full"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("createVirtualHub"),
      farmCode: z.string().regex(/^CG-[A-Z0-9-]{4,32}$/),
    })
    .strict(),
  z
    .object({
      type: z.literal("createVirtualNode"),
      farmCode: z.string().regex(/^CG-[A-Z0-9-]{4,32}$/),
      profile: z.enum(["climate", "air_quality", "sound", "control"]),
      section,
    })
    .strict(),
  z
    .object({
      type: z.literal("pairVirtualDevice"),
      qr: z.string().min(20).max(1000),
    })
    .strict(),
  z.object({ type: z.literal("removeVirtualDevice"), id }).strict(),
]);
export const mutationSchema = z
  .object({
    key: z.uuid(),
    revision: z.number().int().nonnegative(),
    action: actionSchema,
  })
  .strict();
