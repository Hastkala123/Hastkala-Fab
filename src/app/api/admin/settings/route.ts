import { z } from "zod";
import { guard, handler, ok, parseJson } from "@/lib/api";
import { audit } from "@/lib/audit";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { getSettings, saveSetting } from "@/server/settings";
import { SETTING_KEYS, type SettingKey } from "@/server/settings/schema";

export const runtime = "nodejs";

const bodySchema = z.object({
  key: z.enum(SETTING_KEYS as [SettingKey, ...SettingKey[]]),
  value: z.record(z.string(), z.unknown()),
});

/** Saves one section of Admin → Settings, validated against its schema. */
export const PUT = handler(async (request) => {
  const gate = await guard({ auth: "staff", permission: "settings.manage", limit: { bucket: "admin-write", ...RATE_LIMITS.adminWrite } });
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { key, value } = parsed.data;

  const before = (await getSettings())[key];
  const saved = await saveSetting(key, value, gate.ctx.user!.id);
  await audit({ actor: gate.ctx.user, action: "settings.update", entityType: "Setting", entityId: key, before, after: saved });
  return ok({ value: saved });
});
