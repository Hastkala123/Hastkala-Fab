import type { Metadata } from "next";
import { requireStaffPage } from "@/server/auth/page-guard";
import { getSettings } from "@/server/settings";
import { SETTING_KEYS } from "@/server/settings/schema";
import SettingsForm from "./SettingsForm";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireStaffPage("settings.manage");
  const settings = await getSettings();
  const values = Object.fromEntries(SETTING_KEYS.map((key) => [key, settings[key] as Record<string, unknown>]));
  const unsaved = SETTING_KEYS.filter((key) => !settings._saved.has(key));

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">Settings</h1>
      <p className="mt-1 text-sm text-slate-600">
        Changes apply to the shop straight away. Each section saves separately.
      </p>
      {unsaved.length > 0 && (
        <p className="mt-4 rounded-lg border border-turmeric-200 bg-turmeric-50 px-4 py-3 text-sm text-turmeric-900">
          Sections marked &ldquo;not confirmed&rdquo; are still using starting values. Check them and press Save.
        </p>
      )}
      <SettingsForm values={values} unsaved={unsaved} />
    </div>
  );
}
