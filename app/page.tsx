"use client";

import Link from "next/link";
import { BookOpen, ChevronRight, HandHeart, ScrollText, type LucideIcon } from "lucide-react";
import PrayerTimes from "@/components/PrayerTimes";
import { useSettings } from "@/src/context/SettingsContext";

const SECTIONS: { href: string; title: string; desc: string; ar: string; icon: LucideIcon }[] = [
  { href: "/quran", title: "Коран", desc: "Суры и аяты с переводом", ar: "القرآن", icon: BookOpen },
  { href: "/azkar", title: "Азкары", desc: "Утренние, вечерние и после намаза", ar: "الأذكار", icon: HandHeart },
  { href: "/hadiths", title: "Хадисы", desc: "Изречения Пророка ﷺ", ar: "الحديث", icon: ScrollText },
];

export default function HomePage() {
  const { settings } = useSettings();
  const isDark = settings.theme === "dark";

  return (
    <main className="space-y-6 px-4 pt-6">
      <header className="flex items-center justify-center">
        <h1
          className={`text-3xl font-bold tracking-tight ${isDark ? "text-white" : "text-stone-900"}`}
        >
          Мусафир
        </h1>
      </header>

      <PrayerTimes city={settings.city} />

      <section>
        <h2 className={`mb-3 text-sm font-semibold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-stone-500"}`}>Разделы</h2>
        <div className="space-y-3">
          {SECTIONS.map(({ href, title, desc, ar, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-4 rounded-2xl border p-4 transition active:scale-[0.98] ${
                isDark
                  ? "border-white/5 bg-slate-900/60 hover:border-emerald-500/40 hover:bg-slate-900"
                  : "border-stone-200 bg-white hover:border-emerald-500/40 hover:bg-stone-50 shadow-sm"
              }`}
            >
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-500/10 text-emerald-600"
              }`}>
                <Icon className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`font-semibold ${isDark ? "text-white" : "text-stone-900"}`}>{title}</span>
                  <span className={`font-arabic text-lg ${isDark ? "text-emerald-300/70" : "text-emerald-600"}`} dir="rtl">
                    {ar}
                  </span>
                </span>
                <span className={`block truncate text-sm ${isDark ? "text-slate-400" : "text-stone-500"}`}>{desc}</span>
              </span>
              <ChevronRight className={`h-5 w-5 transition group-hover:translate-x-0.5 ${
                isDark ? "text-slate-600 group-hover:text-emerald-400" : "text-stone-400 group-hover:text-emerald-600"
              }`} />
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
