"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  CloudDownload,
  HardDrive,
  Loader2,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { SURAH_RU } from "@/src/data/surahs-ru";
import { useSettings } from "@/src/context/SettingsContext";

const OFFLINE_CACHE_NAME = "musafir-offline-v1";
const OFFLINE_INDEX_KEY = "musafir:offline-surahs";

const ALL_SURAH_IDS = Array.from({ length: 114 }, (_, i) => i + 1);

interface SurahApiEdition {
  ayahs?: Array<{
    audio?: string;
    audioSecondary?: string[];
  }>;
}

function getSurahApiUrl(surahId: number, reciter: string) {
  return `https://api.alquran.cloud/v1/surah/${surahId}/editions/quran-uthmani,ru.kuliev,${reciter}`;
}

export default function OfflineManager() {
  const { settings } = useSettings();
  const isDark = settings.theme === "dark";
  const reciter = settings.reciter || "ar.alafasy";

  const [downloadedIds, setDownloadedIds] = useState<number[]>([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [busySurahs, setBusySurahs] = useState<Record<number, boolean>>({});

  // Состояние массовой загрузки «Скачать всё»
  const [bulkActive, setBulkActive] = useState(false);
  const [bulkDone, setBulkDone] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(114);
  const [currentSurahName, setCurrentSurahName] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [storageUsageText, setStorageUsageText] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Загружаем список скачанных сур и оценку объёма кэша
  const refreshStatus = useCallback(async () => {
    try {
      const saved = JSON.parse(localStorage.getItem(OFFLINE_INDEX_KEY) ?? "[]");
      if (Array.isArray(saved)) {
        setDownloadedIds(saved.filter((n) => typeof n === "number"));
      }
    } catch {
      /* ignore */
    }

    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      try {
        const est = await navigator.storage.estimate();
        if (est.usage) {
          const mb = (est.usage / (1024 * 1024)).toFixed(1);
          setStorageUsageText(`${mb} МБ`);
        }
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [refreshStatus]);

  const persistDownloadedIds = useCallback((ids: number[]) => {
    const unique = Array.from(new Set(ids)).sort((a, b) => a - b);
    setDownloadedIds(unique);
    try {
      localStorage.setItem(OFFLINE_INDEX_KEY, JSON.stringify(unique));
    } catch {
      /* ignore */
    }
  }, []);

  /** Скачивание одной суры (текст, перевод и все аудиофайлы аятов) в Cache API */
  const downloadSingleSurah = useCallback(
    async (surahId: number, signal?: AbortSignal): Promise<boolean> => {
      if (typeof window === "undefined" || !("caches" in window)) {
        setStatusMessage("Ваш браузер не поддерживает Cache API для оффлайн-сохранения.");
        return false;
      }

      const cache = await caches.open(OFFLINE_CACHE_NAME);
      const apiUrl = getSurahApiUrl(surahId, reciter);

      try {
        const res = await fetch(apiUrl, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        // Сохраняем JSON суры (для оффлайн-чтения)
        await cache.put(apiUrl, res.clone());
        const json = await res.json();

        const editions = (json?.data ?? []) as SurahApiEdition[];
        const audioEdition = editions[2] ?? editions[0];
        const audioUrls = (audioEdition?.ayahs ?? [])
          .map((a) => a.audio || a.audioSecondary?.[0] || "")
          .filter(Boolean);

        // Загружаем аудио батчами по 4 файла, чтобы не перегружать сеть
        const BATCH_SIZE = 4;
        for (let i = 0; i < audioUrls.length; i += BATCH_SIZE) {
          if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
          const batch = audioUrls.slice(i, i + BATCH_SIZE);

          await Promise.all(
            batch.map(async (audioUrl) => {
              const already = await cache.match(audioUrl);
              if (already) return;

              try {
                const audioRes = await fetch(audioUrl, { signal, mode: "cors" });
                if (audioRes.ok) {
                  await cache.put(audioUrl, audioRes);
                }
              } catch (err) {
                if ((err as Error)?.name === "AbortError") throw err;
                // Если CDN не отдаёт CORS-заголовки, сохраняем opaque-ответ для <audio>
                const opaqueRes = await fetch(audioUrl, { signal, mode: "no-cors" });
                await cache.put(audioUrl, opaqueRes);
              }
            })
          );
        }

        return true;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          throw err;
        }
        return false;
      }
    },
    [reciter]
  );

  /** Удаление конкретной суры (JSON + аудио аятов) из Cache API */
  const removeSingleSurah = useCallback(
    async (surahId: number) => {
      if (typeof window === "undefined" || !("caches" in window)) return;
      setBusySurahs((prev) => ({ ...prev, [surahId]: true }));

      try {
        const cache = await caches.open(OFFLINE_CACHE_NAME);
        const apiUrl = getSurahApiUrl(surahId, reciter);
        const cachedApi = await cache.match(apiUrl);

        if (cachedApi) {
          try {
            const json = await cachedApi.clone().json();
            const editions = (json?.data ?? []) as SurahApiEdition[];
            const audioEdition = editions[2] ?? editions[0];
            const audioUrls = (audioEdition?.ayahs ?? [])
              .map((a) => a.audio || a.audioSecondary?.[0] || "")
              .filter(Boolean);
            await Promise.all(audioUrls.map((u) => cache.delete(u)));
          } catch {
            /* ignore parse error */
          }
          await cache.delete(apiUrl);
        }

        persistDownloadedIds(downloadedIds.filter((id) => id !== surahId));
        refreshStatus();
      } finally {
        setBusySurahs((prev) => ({ ...prev, [surahId]: false }));
      }
    },
    [downloadedIds, persistDownloadedIds, reciter, refreshStatus]
  );

  const handleToggleSurah = async (surahId: number) => {
    if (busySurahs[surahId] || bulkActive) return;

    if (downloadedIds.includes(surahId)) {
      await removeSingleSurah(surahId);
      return;
    }

    setBusySurahs((prev) => ({ ...prev, [surahId]: true }));
    setStatusMessage(null);
    try {
      const ok = await downloadSingleSurah(surahId);
      if (ok) {
        persistDownloadedIds([...downloadedIds, surahId]);
        refreshStatus();
      } else {
        setStatusMessage(`Не удалось скачать суру №${surahId}. Проверьте интернет.`);
      }
    } finally {
      setBusySurahs((prev) => ({ ...prev, [surahId]: false }));
    }
  };

  /** Скачать все 114 сур и их аудио в Cache API */
  const handleDownloadAll = async () => {
    if (bulkActive) {
      abortControllerRef.current?.abort();
      setBulkActive(false);
      setStatusMessage("Загрузка приостановлена.");
      return;
    }

    const remainingIds = ALL_SURAH_IDS.filter((id) => !downloadedIds.includes(id));
    if (remainingIds.length === 0) {
      setStatusMessage("Все 114 сур уже сохранены для оффлайн-доступа.");
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setBulkActive(true);
    setBulkTotal(114);
    setBulkDone(downloadedIds.length);
    setStatusMessage(null);

    // Предварительно сохраняем список сур
    try {
      const cache = await caches.open(OFFLINE_CACHE_NAME);
      const listUrl = "https://api.alquran.cloud/v1/surah";
      const listRes = await fetch(listUrl, { signal: controller.signal });
      if (listRes.ok) await cache.put(listUrl, listRes);
    } catch {
      /* ignore */
    }

    let currentIds = [...downloadedIds];
    let failedCount = 0;

    for (const id of remainingIds) {
      if (controller.signal.aborted) break;
      const meta = SURAH_RU[id];
      setCurrentSurahName(`Сура ${id}: ${meta?.name ?? ""}`);

      try {
        const ok = await downloadSingleSurah(id, controller.signal);
        if (ok) {
          currentIds = [...currentIds, id];
          persistDownloadedIds(currentIds);
          setBulkDone(currentIds.length);
        } else {
          failedCount++;
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") break;
        failedCount++;
      }
    }

    setBulkActive(false);
    setCurrentSurahName("");
    refreshStatus();

    if (!controller.signal.aborted) {
      if (failedCount === 0) {
        setStatusMessage("Весь Коран и аудио успешно сохранены для работы оффлайн!");
      } else {
        setStatusMessage(`Загрузка завершена (пропущено сур: ${failedCount}).`);
      }
    }
  };

  const handleClearAllOffline = async () => {
    if (bulkActive) return;
    if (typeof window !== "undefined" && "caches" in window) {
      await caches.delete(OFFLINE_CACHE_NAME);
    }
    persistDownloadedIds([]);
    setStorageUsageText(null);
    setStatusMessage("Оффлайн-кэш Корана очищен.");
  };

  const filteredSurahs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ALL_SURAH_IDS;
    return ALL_SURAH_IDS.filter((id) => {
      const info = SURAH_RU[id];
      return (
        String(id).includes(q) ||
        info?.name.toLowerCase().includes(q) ||
        info?.meaning.toLowerCase().includes(q)
      );
    });
  }, [searchQuery]);

  const cardClass = isDark
    ? "bg-slate-900/90 border-slate-800 text-slate-100"
    : "bg-white border-stone-200 text-stone-900 shadow-sm";

  const progressPct = Math.round((bulkDone / bulkTotal) * 100);

  return (
    <div className={`p-4 rounded-2xl border space-y-3.5 ${cardClass}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 font-medium">
          <HardDrive className="w-5 h-5 text-emerald-500" />
          <span>Менеджер оффлайн-контента</span>
        </div>
        <span className={`text-xs tabular-nums ${isDark ? "text-slate-400" : "text-stone-500"}`}>
          {downloadedIds.length}/114 сур{storageUsageText ? ` · ${storageUsageText}` : ""}
        </span>
      </div>

      {/* Две главные кнопки */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={handleDownloadAll}
          className={`w-full py-2.5 px-3.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border transition-all duration-200 ease-in-out active:scale-[0.98] ${
            bulkActive
              ? "bg-amber-500/15 text-amber-400 border-amber-500/40 hover:bg-amber-500/25"
              : "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500"
          }`}
        >
          {bulkActive ? (
            <>
              <X className="w-4 h-4 shrink-0" />
              <span>Остановить ({bulkDone}/114)</span>
            </>
          ) : (
            <>
              <CloudDownload className="w-4 h-4 shrink-0" />
              <span>Скачать всё (Коран и аудио)</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => setManageOpen((prev) => !prev)}
          className={`w-full py-2.5 px-3.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border transition-all duration-200 ease-in-out active:scale-[0.98] ${
            manageOpen
              ? "bg-emerald-600/15 text-emerald-500 border-emerald-500/50"
              : isDark
              ? "bg-slate-800 hover:bg-slate-700/80 text-slate-100 border-slate-700"
              : "bg-stone-100 hover:bg-stone-200/80 text-stone-800 border-stone-200"
          }`}
        >
          {manageOpen ? (
            <ChevronUp className="w-4 h-4 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 shrink-0" />
          )}
          <span>Управлять загрузками</span>
        </button>
      </div>

      {/* Индикатор прогресса массовой загрузки */}
      {bulkActive && (
        <div className="space-y-1.5 pt-1 animate-[fadeIn_0.2s_ease-out]">
          <div className="flex items-center justify-between text-xs">
            <span className={isDark ? "text-emerald-300" : "text-emerald-700"}>
              {currentSurahName || "Подготовка..."}
            </span>
            <span className="tabular-nums font-medium text-emerald-500">{progressPct}%</span>
          </div>
          <div className={`h-2 w-full overflow-hidden rounded-full ${isDark ? "bg-slate-800" : "bg-stone-200"}`}>
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {statusMessage && (
        <p
          className={`text-xs rounded-xl px-3 py-2 border ${
            isDark
              ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-200"
              : "border-emerald-500/30 bg-emerald-50 text-emerald-800"
          }`}
        >
          {statusMessage}
        </p>
      )}

      {/* Панель выборочного управления загрузками */}
      {manageOpen && (
        <div className="pt-2 space-y-3 border-t border-slate-800/40 animate-[fadeIn_0.2s_ease-out]">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Найти суру (1–114)..."
                className={`w-full rounded-xl border py-2 pl-8 pr-3 text-xs outline-none ${
                  isDark
                    ? "border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500"
                    : "border-stone-300 bg-stone-50 text-stone-900 placeholder-stone-400"
                }`}
              />
            </div>

            {downloadedIds.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllOffline}
                disabled={bulkActive}
                title="Удалить весь оффлайн-кэш"
                className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-2 text-xs font-medium transition active:scale-95 disabled:opacity-40 ${
                  isDark
                    ? "border-red-500/30 bg-red-950/30 text-red-300 hover:bg-red-950/50"
                    : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Очистить</span>
              </button>
            )}
          </div>

          <ul className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
            {filteredSurahs.map((id) => {
              const info = SURAH_RU[id];
              const isDownloaded = downloadedIds.includes(id);
              const isBusy = Boolean(busySurahs[id]);

              return (
                <li
                  key={id}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${
                    isDark
                      ? "border-slate-800 bg-slate-950/50"
                      : "border-stone-200 bg-stone-50/70"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {id}. {info?.name}
                    </p>
                    {info?.meaning && (
                      <p className={`text-[11px] truncate ${isDark ? "text-slate-400" : "text-stone-500"}`}>
                        {info.meaning}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isBusy || bulkActive}
                    onClick={() => handleToggleSurah(id)}
                    className={`shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium border transition active:scale-95 disabled:opacity-50 ${
                      isDownloaded
                        ? isDark
                          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400 hover:border-red-500/40 hover:bg-red-500/15 hover:text-red-300"
                          : "border-emerald-500/40 bg-emerald-50 text-emerald-700 hover:border-red-400 hover:bg-red-50 hover:text-red-600"
                        : isDark
                        ? "border-slate-700 bg-slate-800 text-slate-200 hover:border-emerald-500/50 hover:text-emerald-300"
                        : "border-stone-300 bg-white text-stone-700 hover:border-emerald-500/50 hover:text-emerald-700"
                    }`}
                  >
                    {isBusy ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Загрузка</span>
                      </>
                    ) : isDownloaded ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Скачано</span>
                      </>
                    ) : (
                      <>
                        <CloudDownload className="w-3 h-3" />
                        <span>Скачать</span>
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
