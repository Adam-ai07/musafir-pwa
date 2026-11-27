"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, RefreshCw, Search, Sparkles, X } from "lucide-react";
import {
  formatAyahCount,
  formatRevelationType,
  getSurahRuMeaning,
  getSurahRuName,
  LAST_READ_SURAH_KEY,
  type LastReadSurah,
  type SurahMeta,
} from "@/src/data/surahs-ru";
import { useSettings } from "@/src/context/SettingsContext";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const LOCAL_SURAH_LIST_URL = `${BASE_PATH}/data/surahs.json`;
const SURAH_LIST_URL = "https://api.alquran.cloud/v1/surah";
const SURAH_CACHE_KEY = "noor:surah-list";

function parseLastRead(raw: string | null): LastReadSurah | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "number" && parsed >= 1 && parsed <= 114) {
      return { number: parsed, ruName: getSurahRuName(parsed) };
    }
    if (parsed && typeof parsed === "object") {
      const num = Number(parsed.number ?? parsed.id);
      if (num >= 1 && num <= 114) {
        return {
          number: num,
          ruName: parsed.ruName || parsed.name || getSurahRuName(num),
          arabicName: parsed.arabicName,
          englishName: parsed.englishName,
          ayah: parsed.ayah ? Number(parsed.ayah) : undefined,
        };
      }
    }
  } catch {
    const num = Number(raw);
    if (num >= 1 && num <= 114) {
      return { number: num, ruName: getSurahRuName(num) };
    }
  }
  return null;
}

export default function QuranPage() {
  const { settings } = useSettings();
  const isDark = settings.theme === "dark";
  const [surahs, setSurahs] = useState<SurahMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [lastRead, setLastRead] = useState<LastReadSurah | null>(null);

  useEffect(() => {
    setLastRead(parseLastRead(localStorage.getItem(LAST_READ_SURAH_KEY)));
  }, []);

  const loadSurahs = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorDetails(null);

    try {
      const cached = localStorage.getItem(SURAH_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length === 114) {
          setSurahs(parsed);
          setLoading(false);
        }
      }
    } catch {
      /* игнорируем повреждённый кэш */
    }

    // 1. В первую очередь загружаем список всех 114 сур из локального JSON в public/data/surahs.json
    try {
      const localRes = await fetch(LOCAL_SURAH_LIST_URL);
      if (localRes.ok) {
        const localData = await localRes.json();
        if (Array.isArray(localData) && localData.length === 114) {
          setSurahs(localData);
          localStorage.setItem(SURAH_CACHE_KEY, JSON.stringify(localData));
          setLoading(false);
          return;
        }
      }
    } catch {
      /* переходим к внешнему API по https:// */
    }

    // 2. Резервный запрос к внешнему API строго по https:// без лишних CORS-заголовков
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(SURAH_LIST_URL, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.code !== 200 || !Array.isArray(json.data)) {
        throw new Error("Некорректный ответ API");
      }
      setSurahs(json.data);
      localStorage.setItem(SURAH_CACHE_KEY, JSON.stringify(json.data));
    } catch (err) {
      const techMsg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      setSurahs((prev) => {
        if (prev.length === 0) {
          setError("Не удалось загрузить список сур. Проверьте подключение к интернету.");
          setErrorDetails(`${techMsg} · URL: ${SURAH_LIST_URL}`);
        }
        return prev;
      });
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSurahs();
  }, [loadSurahs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return surahs;

    return surahs.filter((s) => {
      const ruName = getSurahRuName(s.number, s.englishName).toLowerCase();
      const ruMeaning = getSurahRuMeaning(s.number, s.englishNameTranslation).toLowerCase();
      const enName = s.englishName.toLowerCase();
      const enTrans = (s.englishNameTranslation ?? "").toLowerCase();
      const numStr = String(s.number);

      return (
        numStr === q ||
        numStr.startsWith(q) ||
        ruName.includes(q) ||
        ruMeaning.includes(q) ||
        enName.includes(q) ||
        enTrans.includes(q)
      );
    });
  }, [surahs, query]);

  return (
    <main className="space-y-4 px-4 pt-6">
      <header className="flex items-center justify-center">
        <h1 className={`text-3xl font-bold ${isDark ? "text-white" : "text-stone-900"}`}>Коран</h1>
      </header>

      {/* Карточка «Продолжить чтение» */}
      {lastRead && (
        <Link
          href={`/quran/${lastRead.number}`}
          prefetch={false}
          className={`group relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border p-4 transition active:scale-[0.99] ${
            isDark
              ? "border-emerald-500/40 bg-gradient-to-r from-emerald-900/70 via-emerald-950/70 to-slate-900/90 shadow-lg shadow-emerald-950/30 hover:border-emerald-400"
              : "border-emerald-500/40 bg-emerald-50/80 shadow-sm hover:border-emerald-500 hover:bg-emerald-50"
          }`}
        >
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <span
                className={`flex items-center gap-1.5 text-xs font-medium ${
                  isDark ? "text-emerald-300" : "text-emerald-700"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Продолжить чтение
              </span>
              <p
                className={`mt-0.5 text-base font-bold ${
                  isDark ? "text-white" : "text-stone-900"
                }`}
              >
                Продолжить чтение: Сура №{lastRead.number} {lastRead.ruName}
              </p>
              {lastRead.ayah && (
                <p
                  className={`text-xs ${
                    isDark ? "text-emerald-200/70" : "text-emerald-700/80"
                  }`}
                >
                  Остановились на аяте {lastRead.ayah}
                </p>
              )}
            </div>
          </div>
          <ChevronRight
            className={`h-5 w-5 shrink-0 transition group-hover:translate-x-0.5 ${
              isDark ? "text-emerald-300" : "text-emerald-600"
            }`}
          />
        </Link>
      )}

      {/* Строка поиска */}
      <div
        className={`sticky top-[env(safe-area-inset-top)] z-20 -mx-4 px-4 py-2 backdrop-blur-lg ${
          isDark ? "bg-slate-950/90" : "bg-stone-100/90"
        }`}
      >
        <div className="relative">
          <Search
            className={`pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${
              isDark ? "text-slate-400" : "text-stone-400"
            }`}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию или номеру суры (1–114)..."
            aria-label="Поиск суры"
            className={`w-full rounded-2xl border py-3 pl-10 pr-10 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 ${
              isDark
                ? "border-white/10 bg-slate-900/90 text-white placeholder-slate-500"
                : "border-stone-200 bg-white text-stone-900 placeholder-stone-400 shadow-xs"
            }`}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Очистить поиск"
              className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 ${
                isDark
                  ? "text-slate-400 hover:bg-slate-800 hover:text-white"
                  : "text-stone-400 hover:bg-stone-100 hover:text-stone-900"
              }`}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Состояние загрузки */}
      {loading && surahs.length === 0 && (
        <div className="space-y-2.5">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className={`h-20 animate-pulse rounded-2xl border ${
                isDark ? "border-white/5 bg-slate-900/80" : "border-stone-200 bg-white"
              }`}
            />
          ))}
        </div>
      )}

      {/* Ошибка */}
      {error && surahs.length === 0 && (
        <div
          className={`rounded-2xl border p-6 text-center ${
            isDark
              ? "border-amber-500/30 bg-slate-900/80"
              : "border-amber-300 bg-white shadow-sm"
          }`}
        >
          <p className={`text-sm ${isDark ? "text-amber-300" : "text-amber-700"}`}>{error}</p>
          {errorDetails && (
            <p className="mt-1.5 break-all font-mono text-[11px] opacity-75">{errorDetails}</p>
          )}
          <button
            type="button"
            onClick={loadSurahs}
            className="mx-auto mt-4 flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            <RefreshCw className="h-4 w-4" />
            Повторить
          </button>
        </div>
      )}

      {/* Список сур */}
      {surahs.length > 0 && (
        <>
          {filtered.length === 0 ? (
            <div
              className={`rounded-2xl border py-12 text-center ${
                isDark
                  ? "border-white/5 bg-slate-900/60"
                  : "border-stone-200 bg-white shadow-sm"
              }`}
            >
              <p className={`text-sm ${isDark ? "text-slate-400" : "text-stone-500"}`}>
                По запросу «{query}» суры не найдены
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5 pb-4">
              {filtered.map((surah) => {
                const ruName = getSurahRuName(surah.number, surah.englishName);
                const ruMeaning = getSurahRuMeaning(surah.number, surah.englishNameTranslation);
                const isLastRead = lastRead?.number === surah.number;

                return (
                  <li key={surah.number}>
                    <Link
                      href={`/quran/${surah.number}`}
                      prefetch={false}
                      className={`group flex items-center gap-3.5 rounded-2xl border p-3.5 transition active:scale-[0.99] ${
                        isLastRead
                          ? isDark
                            ? "border-emerald-500/50 bg-slate-900/90"
                            : "border-emerald-500/60 bg-emerald-50/40 shadow-sm"
                          : isDark
                          ? "border-white/5 bg-slate-900/80 hover:border-emerald-500/40 hover:bg-slate-900"
                          : "border-stone-200 bg-white hover:border-emerald-500/40 hover:bg-stone-50 shadow-sm"
                      }`}
                    >
                      {/* Номер суры */}
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-sm font-bold tabular-nums transition ${
                          isDark
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950"
                            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white"
                        }`}
                      >
                        {surah.number}
                      </span>

                      {/* Название и мета-информация */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <h2
                            className={`truncate text-base font-semibold ${
                              isDark ? "text-white" : "text-stone-900"
                            }`}
                          >
                            {ruName}
                            <span
                              className={`ml-1.5 text-xs font-normal ${
                                isDark ? "text-slate-400" : "text-stone-500"
                              }`}
                            >
                              ({surah.englishName})
                            </span>
                          </h2>
                          <span
                            dir="rtl"
                            lang="ar"
                            className={`shrink-0 font-arabic text-lg ${
                              isDark ? "text-emerald-400" : "text-emerald-600"
                            }`}
                          >
                            {surah.name}
                          </span>
                        </div>

                        <div
                          className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs ${
                            isDark ? "text-slate-400" : "text-stone-500"
                          }`}
                        >
                          {ruMeaning && (
                            <span className={isDark ? "text-slate-300" : "text-stone-700"}>
                              {ruMeaning}
                            </span>
                          )}
                          {ruMeaning && (
                            <span className={isDark ? "text-slate-600" : "text-stone-300"}>•</span>
                          )}
                          <span>{formatAyahCount(surah.numberOfAyahs)}</span>
                          <span className={isDark ? "text-slate-600" : "text-stone-300"}>•</span>
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                              isDark
                                ? "bg-emerald-500/10 text-emerald-300"
                                : "bg-emerald-500/10 text-emerald-700"
                            }`}
                          >
                            {formatRevelationType(surah.revelationType)}
                          </span>
                        </div>
                      </div>

                      <ChevronRight
                        className={`h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 ${
                          isDark
                            ? "text-slate-600 group-hover:text-emerald-400"
                            : "text-stone-400 group-hover:text-emerald-600"
                        }`}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
