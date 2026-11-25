"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, MapPin, RefreshCw } from "lucide-react";
import { useSettings } from "@/src/context/SettingsContext";

const CITY_NAMES_RU: Record<string, string> = {
  Grozny: "Грозный",
  Nazran: "Назрань",
  Makhachkala: "Махачкала",
  Moscow: "Москва",
  Kazan: "Казань",
};

const CACHE_KEY_PREFIX = "noor:prayer-times";

const PRAYERS = [
  { key: "Fajr", name: "Фаджр", ar: "الفجر" },
  { key: "Sunrise", name: "Восход", ar: "الشروق" },
  { key: "Dhuhr", name: "Зухр", ar: "الظهر" },
  { key: "Asr", name: "Аср", ar: "العصر" },
  { key: "Maghrib", name: "Магриб", ar: "المغرب" },
  { key: "Isha", name: "Иша", ar: "العشاء" },
] as const;

type PrayerKey = (typeof PRAYERS)[number]["key"];

interface AladhanData {
  timings: Record<PrayerKey, string>;
  date: {
    readable: string;
    gregorian: { date: string };
    hijri?: { day: string; year: string; month: { en: string; ar: string } };
  };
  meta: { timezone: string };
}

/** Примерное расписание для Грозного (ноябрь, метод MWL) — если API и кэш недоступны */
const FALLBACK_TIMINGS: Record<PrayerKey, string> = {
  Fajr: "05:15",
  Sunrise: "06:55",
  Dhuhr: "11:43",
  Asr: "14:10",
  Maghrib: "16:29",
  Isha: "18:04",
};

function fallbackData(): AladhanData {
  const date = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow" }).format(new Date());
  return {
    timings: FALLBACK_TIMINGS,
    date: { readable: date, gregorian: { date } },
    meta: { timezone: "Europe/Moscow" },
  };
}

/** Текущее время (в минутах от полуночи) в часовом поясе города */
function nowMinutesIn(timeZone: string): { minutes: number; seconds: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { minutes: get("hour") * 60 + get("minute"), seconds: get("second") };
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};

function formatCountdown(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function PrayerTimes({ city = "Grozny" }: { city?: string }) {
  const { settings } = useSettings();
  const isDark = settings.theme === "dark";
  const currentCity = city || "Grozny";
  const displayCity = CITY_NAMES_RU[currentCity] || currentCity;
  const apiUrl = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(currentCity)}&country=Russia&method=3`;
  const cacheKey = `${CACHE_KEY_PREFIX}:${currentCity}`;

  const [data, setData] = useState<AladhanData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Таймаут, чтобы виджет не «висел» на скелетоне при медленной сети
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(apiUrl, { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.code !== 200 || !json.data?.timings) throw new Error(json.status ?? "Ошибка API");
      setData(json.data);
      localStorage.setItem(cacheKey, JSON.stringify(json.data));
    } catch {
      let cached: AladhanData | null = null;
      try {
        cached = JSON.parse(localStorage.getItem(cacheKey) ?? "null");
      } catch {
        /* игнорируем повреждённый кэш */
      }
      if (cached?.timings) {
        setData(cached);
        setError("Нет связи с сервером — показано сохранённое расписание");
      } else {
        setData(fallbackData());
        setError("Сервер недоступен — показано примерное расписание");
      }
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, [apiUrl, cacheKey]);

  useEffect(() => {
    load();
  }, [load]);

  // Тик раз в секунду для обратного отсчёта
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const timeZone = data?.meta.timezone ?? "Europe/Moscow";
  const { minutes: nowMin, seconds: nowSec } = nowMinutesIn(timeZone);

  const next = useMemo(() => {
    if (!data) return null;
    const list = PRAYERS.filter((p) => p.key !== "Sunrise");
    const upcoming = list.find((p) => toMinutes(data.timings[p.key]) > nowMin);
    const prayer = upcoming ?? list[0]; // после Иша — Фаджр следующего дня
    let diff = toMinutes(data.timings[prayer.key]) - nowMin;
    if (diff <= 0) diff += 24 * 60;
    return { prayer, secondsLeft: diff * 60 - nowSec };
  }, [data, nowMin, nowSec]);

  return (
    <section
      className={`overflow-hidden rounded-3xl border p-5 transition-colors ${
        isDark
          ? "border-emerald-800/40 bg-gradient-to-br from-emerald-900/60 via-emerald-950/60 to-slate-900 shadow-lg shadow-emerald-950/40"
          : "border-stone-200 bg-white shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div
            className={`flex items-center gap-1.5 text-xs font-medium ${
              isDark ? "text-emerald-300/80" : "text-emerald-700"
            }`}
          >
            <MapPin className="h-3.5 w-3.5" />
            {displayCity}, Россия
          </div>
          {data && (
            <p className={`mt-1 text-xs ${isDark ? "text-slate-400" : "text-stone-500"}`}>
              {data.date.gregorian.date}
              {data.date.hijri && (
                <>
                  {" · "}
                  <span
                    className={`font-arabic text-sm ${
                      isDark ? "text-emerald-200/90" : "text-emerald-700"
                    }`}
                    dir="rtl"
                  >
                    {data.date.hijri.day} {data.date.hijri.month.ar} {data.date.hijri.year}
                  </span>
                </>
              )}
            </p>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          aria-label="Обновить"
          className={`rounded-full p-2 transition disabled:opacity-50 ${
            isDark
              ? "text-emerald-300 hover:bg-emerald-500/10"
              : "text-emerald-600 hover:bg-emerald-50"
          }`}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && !data ? (
        <div className="mt-5 space-y-3">
          <div
            className={`h-10 w-2/3 animate-pulse rounded-xl ${
              isDark ? "bg-emerald-900/40" : "bg-stone-200"
            }`}
          />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`h-16 animate-pulse rounded-2xl ${
                  isDark ? "bg-emerald-900/30" : "bg-stone-100"
                }`}
              />
            ))}
          </div>
        </div>
      ) : data && next ? (
        <>
          <div className="mt-4">
            <p
              className={`text-xs uppercase tracking-wider ${
                isDark ? "text-slate-400" : "text-stone-500"
              }`}
            >
              Следующий намаз
            </p>
            <div className="mt-1 flex items-end justify-between gap-3">
              <div>
                <h2 className={`text-3xl font-bold ${isDark ? "text-white" : "text-stone-900"}`}>
                  {next.prayer.name}
                </h2>
                <p
                  className={`font-arabic text-xl ${
                    isDark ? "text-emerald-300" : "text-emerald-600"
                  }`}
                  dir="rtl"
                >
                  {next.prayer.ar}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={`text-2xl font-semibold tabular-nums ${
                    isDark ? "text-emerald-400" : "text-emerald-600"
                  }`}
                >
                  {data.timings[next.prayer.key].slice(0, 5)}
                </p>
                <p
                  className={`flex items-center justify-end gap-1 text-xs tabular-nums ${
                    isDark ? "text-slate-400" : "text-stone-500"
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  через {formatCountdown(next.secondsLeft)}
                </p>
              </div>
            </div>
          </div>

          <ul className="mt-5 grid grid-cols-3 gap-2">
            {PRAYERS.map((p) => {
              const isNext = p.key === next.prayer.key;
              return (
                <li
                  key={p.key}
                  className={`rounded-2xl border px-3 py-2.5 text-center transition ${
                    isNext
                      ? isDark
                        ? "border-emerald-500 bg-emerald-500/15 shadow-[0_0_20px_-6px] shadow-emerald-500"
                        : "border-emerald-500 bg-emerald-50 shadow-xs"
                      : isDark
                      ? "border-white/5 bg-slate-950/40"
                      : "border-stone-200 bg-stone-50"
                  }`}
                >
                  <p
                    className={`text-xs ${
                      isNext
                        ? isDark
                          ? "text-emerald-300"
                          : "font-medium text-emerald-700"
                        : isDark
                        ? "text-slate-400"
                        : "text-stone-500"
                    }`}
                  >
                    {p.name}
                  </p>
                  <p
                    className={`mt-0.5 text-base font-semibold tabular-nums ${
                      isNext
                        ? isDark
                          ? "text-white"
                          : "text-stone-900"
                        : isDark
                        ? "text-slate-200"
                        : "text-stone-800"
                    }`}
                  >
                    {data.timings[p.key].slice(0, 5)}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {error && (
        <p
          className={`mt-3 text-center text-xs ${
            isDark ? "text-amber-400/90" : "text-amber-600"
          }`}
        >
          {error}
        </p>
      )}
    </section>
  );
}
