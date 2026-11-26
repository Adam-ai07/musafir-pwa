"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, HandHeart, Home, ScrollText, Settings } from "lucide-react";
import { useSettings } from "@/src/context/SettingsContext";

const NAV_ITEMS = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/quran", label: "Коран", icon: BookOpen },
  { href: "/azkar", label: "Азкары", icon: HandHeart },
  { href: "/hadiths", label: "Хадисы", icon: ScrollText },
  { href: "/settings", label: "Настройки", icon: Settings },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const { settings } = useSettings();
  const isDark = settings.theme === "dark";

  return (
    <nav
      aria-label="Основная навигация"
      className={`fixed inset-x-0 bottom-0 z-50 border-t backdrop-blur-lg pb-safe transition-colors ${
        isDark
          ? "border-emerald-900/40 bg-slate-950/90"
          : "border-stone-200 bg-white/90"
      }`}
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                  active
                    ? isDark ? "text-emerald-400" : "text-emerald-600"
                    : isDark ? "text-slate-500 hover:text-slate-300" : "text-stone-400 hover:text-stone-600"
                }`}
              >
                <span
                  className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${
                    active ? (isDark ? "bg-emerald-500/15" : "bg-emerald-500/10") : ""
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
