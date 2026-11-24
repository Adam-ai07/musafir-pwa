
export type AzkarCategory = "morning" | "evening" | "after_prayer" | "dua";

export interface Zikr {
  id: string;
  category: AzkarCategory;
  title?: string;
  arabic: string;
  transcription: string;
  translation: string;
  count: number;
  source?: string;
}

export const AZKAR_CATEGORIES: { key: AzkarCategory; label: string }[] = [
  { key: "morning", label: "Утро" },
  { key: "evening", label: "Вечер" },
  { key: "after_prayer", label: "После намаза" },
  { key: "dua", label: "Дуа" },
];
