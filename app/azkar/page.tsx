"use client";

import AzkarList from "@/components/AzkarList";
import azkarData from "@/src/data/azkar.json";
import type { Zikr } from "@/src/data/azkar";
import { useSettings } from "@/src/context/SettingsContext";

const azkar = azkarData as Zikr[];

export default function AzkarPage() {
  const { settings } = useSettings();
  const isDark = settings.theme === "dark";

  return (
    <main className="px-4 pt-6">
      <header className="mb-4">
        <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-stone-900"}`}>Азкары</h1>
      </header>
      <AzkarList azkar={azkar} />
    </main>
  );
}
