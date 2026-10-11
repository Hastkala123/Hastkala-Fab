import "server-only";

import { cache } from "react";
import { db } from "@/lib/db";
import type { QuoteSettings } from "@/server/orders/quote";
import {
  parseStoredSetting,
  SETTING_KEYS,
  SETTING_SCHEMAS,
  type AllSettings,
  type SettingKey,
  type SettingValue,
} from "./schema";

/** All settings, read once per request. */
export const getSettings = cache(async (): Promise<AllSettings & { _saved: Set<SettingKey> }> => {
  const rows = await db.setting.findMany({ where: { key: { in: SETTING_KEYS } } });
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const settings = Object.fromEntries(
    SETTING_KEYS.map((key) => [key, parseStoredSetting(key, byKey.get(key))]),
  ) as AllSettings;
  return { ...settings, _saved: new Set(rows.map((r) => r.key as SettingKey)) };
});

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const settings: AllSettings = await getSettings();
  return settings[key];
}

/** Validates strictly and saves one settings section. */
export async function saveSetting<K extends SettingKey>(
  key: K,
  value: unknown,
  updatedById: string | null,
): Promise<SettingValue<K>> {
  const parsed = SETTING_SCHEMAS[key].parse(value) as SettingValue<K>;
  await db.setting.upsert({
    where: { key },
    create: { key, value: parsed as object, updatedById },
    update: { value: parsed as object, updatedById },
  });
  return parsed;
}

/** The slice of settings the checkout calculator needs. */
export function toQuoteSettings(settings: AllSettings): QuoteSettings {
  return {
    wholesalePricesIncludeTax: settings.tax.wholesalePricesIncludeTax,
    freeShippingThreshold: settings.shipping.freeShippingThreshold,
    retailShippingFee: settings.shipping.retailFee,
    wholesaleShippingFee: settings.shipping.wholesaleFee,
    codEnabled: settings.cod.enabled,
    codFee: settings.cod.fee,
    codMaxOrderValue: settings.cod.maxOrderValue,
    giftWrapFee: settings.checkout.giftWrapEnabled ? settings.checkout.giftWrapFee : 0,
    feeTaxMode: settings.tax.feeTaxMode,
    roundTotalToRupee: settings.tax.roundTotalToRupee,
  };
}
