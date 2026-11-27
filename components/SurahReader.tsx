"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ListMusic,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Volume2,
} from "lucide-react";
import {
  formatAyahCount,
  formatRevelationType,
  getSurahRuMeaning,
  getSurahRuName,
  LAST_READ_SURAH_KEY,
  type LastReadSurah,
} from "@/src/data/surahs-ru";
import { useSettings, type FontSizeType } from "@/src/context/SettingsContext";
import ScrollRevealTranslation from "@/components/ScrollRevealTranslation";

interface MergedAyah {
  number: number;
  numberInSurah: number;
  arabic: string;
  translation: string;
  audio: string;
}

interface SurahDetails {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: string;
  numberOfAyahs: number;
  ayahs: MergedAyah[];
}

const OFFLINE_CACHE_NAME = "musafir-offline-v1";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

interface LocalSurahJson {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: string;
  numberOfAyahs: number;
  ayahs: Array<{
    number: number;
    numberInSurah: number;
    arabic: string;
    translation: string;
    audio?: string;
  }>;
}

function buildSurahDetailsFromLocal(raw: LocalSurahJson, reciter: string): SurahDetails {
  return {
    number: raw.number,
    name: raw.name,
    englishName: raw.englishName,
    englishNameTranslation: raw.englishNameTranslation,
    revelationType: raw.revelationType,
    numberOfAyahs: raw.numberOfAyahs || raw.ayahs.length,
    ayahs: raw.ayahs.map((a) => ({
      number: a.number,
      numberInSurah: a.numberInSurah,
      arabic: a.arabic,
      translation: a.translation,
      audio: `https://cdn.islamic.network/quran/audio/128/${reciter}/${a.number}.mp3`,
    })),
  };
}

/** Фоновое сохранение одного аудиофайла в Cache API без блокировки воспроизведения */
async function cacheAudioInBackground(audioUrl: string) {
  if (!audioUrl || typeof window === "undefined" || !("caches" in window)) return;
  try {
    const cache = await caches.open(OFFLINE_CACHE_NAME);
    const existing = await cache.match(audioUrl);
    if (existing) return;

    try {
      const res = await fetch(audioUrl, { mode: "cors" });
      if (res.ok) {
        await cache.put(audioUrl, res);
        return;
      }
    } catch {
      const opaqueRes = await fetch(audioUrl, { mode: "no-cors" });
      await cache.put(audioUrl, opaqueRes);
    }
  } catch {
    /* оффлайн или ошибка сети — игнорируем */
  }
}

/** Фоновое сохранение всех аудиофайлов суры в Cache API при нажатии «Слушать» */
async function cacheSurahAudioInBackground(details: SurahDetails) {
  if (typeof window === "undefined" || !("caches" in window)) return;
  const urls = details.ayahs.map((a) => a.audio).filter(Boolean);
  const BATCH_SIZE = 3;
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    await Promise.allSettled(urls.slice(i, i + BATCH_SIZE).map((u) => cacheAudioInBackground(u)));
  }
}

const FONT_SIZES: { key: FontSizeType; label: string; className: string }[] = [
  { key: "sm", label: "Мелкий", className: "text-[1.45rem] leading-[2.15]" },
  { key: "md", label: "Средний", className: "text-[1.8rem] leading-[2.25]" },
  { key: "lg", label: "Крупный", className: "text-[2.2rem] leading-[2.35]" },
];

export default function SurahReaderPage() {
  const params = useParams<{ id: string }>();
  const surahId = Number(params?.id);

  const { settings, updateSetting } = useSettings();
  const isDark = settings.theme === "dark";

  const [surah, setSurah] = useState<SurahDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  // Состояние аудиоплеера
  const [activeAyah, setActiveAyah] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [playAll, setPlayAll] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playAllRef = useRef(playAll);
  playAllRef.current = playAll;
  const surahRef = useRef<SurahDetails | null>(null);
  surahRef.current = surah;
  const activeAyahRef = useRef<number | null>(null);
  activeAyahRef.current = activeAyah;

  // Сохранение последней прочитанной суры в localStorage
  const saveLastRead = useCallback((details: SurahDetails, ayahNum?: number) => {
    const payload: LastReadSurah = {
      number: details.number,
      ruName: getSurahRuName(details.number, details.englishName),
      arabicName: details.name,
      englishName: details.englishName,
      ayah: ayahNum,
    };
    localStorage.setItem(LAST_READ_SURAH_KEY, JSON.stringify(payload));
  }, []);

  // Остановка аудио при размонтировании или смене суры
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setIsPlaying(false);
    setAudioLoading(false);
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  // Воспроизведение конкретного аята по его номеру в суре (1..N)
  const playAyah = useCallback(
    (numberInSurah: number, continuous?: boolean) => {
      const currentSurah = surahRef.current;
      if (!currentSurah) return;

      const target = currentSurah.ayahs.find((a) => a.numberInSurah === numberInSurah);
      if (!target?.audio) return;

      if (settings.vibration && typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(20);
      }

      if (typeof continuous === "boolean") {
        setPlayAll(continuous);
        playAllRef.current = continuous;
      }

      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.preload = "auto";
      }

      const audio = audioRef.current;

      // Если этот же аят уже выбран — переключаем паузу/воспроизведение
      if (activeAyahRef.current === numberInSurah && audio.src === target.audio) {
        if (audio.paused) {
          setAudioLoading(true);
          audio
            .play()
            .then(() => {
              setIsPlaying(true);
              setAudioLoading(false);
            })
            .catch(() => {
              setIsPlaying(false);
              setAudioLoading(false);
            });
        } else {
          audio.pause();
          setIsPlaying(false);
        }
        return;
      }

      // Переключаемся на новый аят
      audio.pause();
      setActiveAyah(numberInSurah);
      activeAyahRef.current = numberInSurah;
      setAudioLoading(true);
      setIsPlaying(false);

      saveLastRead(currentSurah, numberInSurah);

      // Плавная прокрутка к активному аяту
      const el = document.getElementById(`ayah-${numberInSurah}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      audio.src = target.audio;
      // Автоматически сохраняем воспроизводимый аудиофайл в Cache API для оффлайн-прослушивания
      void cacheAudioInBackground(target.audio);
      audio.onplaying = () => {
        setIsPlaying(true);
        setAudioLoading(false);
      };
      audio.onpause = () => {
        setIsPlaying(false);
      };
      audio.onerror = () => {
        setIsPlaying(false);
        setAudioLoading(false);
      };
      audio.onended = () => {
        const s = surahRef.current;
        const curr = activeAyahRef.current;
        if (playAllRef.current && s && curr && curr < s.numberOfAyahs) {
          playAyah(curr + 1, true);
        } else {
          setIsPlaying(false);
          setPlayAll(false);
          playAllRef.current = false;
        }
      };

      audio.play().catch(() => {
        setIsPlaying(false);
        setAudioLoading(false);
      });
    },
    [saveLastRead, settings.vibration]
  );

  // Кнопка «Слушать всю суру подряд»
  const togglePlayAll = () => {
    if (!surah) return;

    if (playAll && isPlaying) {
      // Если уже играет вся сура — ставим на паузу и выключаем режим
      audioRef.current?.pause();
      setIsPlaying(false);
      setPlayAll(false);
      playAllRef.current = false;
      return;
    }

    const startFrom = activeAyah ?? 1;
    setPlayAll(true);
    playAllRef.current = true;
    // Фоново кэшируем все аудиофайлы текущей суры в Cache API
    void cacheSurahAudioInBackground(surah);

    if (activeAyah === startFrom && audioRef.current && audioRef.current.src) {
      if (audioRef.current.paused) {
        audioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    } else {
      playAyah(startFrom, true);
    }
  };

  // Загрузка суры в трёх редакциях одним запросом
  const loadSurah = useCallback(async () => {
    if (!surahId || surahId < 1 || surahId > 114) {
      setError("Указан некорректный номер суры (допустимо 1–114).");
      setLoading(false);
      return;
    }

    stopAudio();
    setActiveAyah(null);
    setPlayAll(false);
    setLoading(true);
    setError(null);
    setErrorDetails(null);

    const reciter = settings.reciter || "ar.alafasy";
    const lsCacheKey = `noor:surah-details:${surahId}:${reciter}`;
    let cachedDetails: SurahDetails | null = null;
    try {
      const raw = localStorage.getItem(lsCacheKey);
      if (raw) {
        const parsed = JSON.parse(raw) as SurahDetails;
        if (parsed?.number === surahId && Array.isArray(parsed.ayahs) && parsed.ayahs.length > 0) {
          cachedDetails = parsed;
          setSurah(parsed);
          setLoading(false);
        }
      }
    } catch {
      /* игнорируем повреждённый кэш */
    }

    // 1. В первую очередь берём текст суры (арабский + русский перевод) из локального JSON в public/data/
    const localSurahUrl = `${BASE_PATH}/data/surahs/${surahId}.json`;
    const localAllQuranUrl = `${BASE_PATH}/data/quran.json`;
    let lastAttemptedUrl = localSurahUrl;

    try {
      const localRes = await fetch(localSurahUrl);
      if (localRes.ok) {
        const localJson = (await localRes.json()) as LocalSurahJson;
        if (localJson?.number === surahId && Array.isArray(localJson.ayahs)) {
          const details = buildSurahDetailsFromLocal(localJson, reciter);
          setSurah(details);
          saveLastRead(details);
          setLoading(false);
          try {
            localStorage.setItem(lsCacheKey, JSON.stringify(details));
          } catch {
            /* ignore quota */
          }
          return;
        }
      }

      // Фолбэк на общий локальный файл public/data/quran.json (все 114 сур)
      lastAttemptedUrl = localAllQuranUrl;
      const allRes = await fetch(localAllQuranUrl);
      if (allRes.ok) {
        const allList = (await allRes.json()) as LocalSurahJson[];
        const found = Array.isArray(allList)
          ? allList.find((s) => s.number === surahId)
          : undefined;
        if (found && Array.isArray(found.ayahs)) {
          const details = buildSurahDetailsFromLocal(found, reciter);
          setSurah(details);
          saveLastRead(details);
          setLoading(false);
          try {
            localStorage.setItem(lsCacheKey, JSON.stringify(details));
          } catch {
            /* ignore quota */
          }
          return;
        }
      }
    } catch {
      /* Если локальные файлы недоступны — переходим к внешнему HTTPS API */
    }

    // 2. Внешний API строго по https:// без кастомных заголовков (чтобы не вызывать CORS preflight в Safari на iOS)
    const url = `https://api.alquran.cloud/v1/surah/${surahId}/editions/quran-uthmani,ru.kuliev,${reciter}`;
    lastAttemptedUrl = url;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.code !== 200 || !Array.isArray(json.data) || json.data.length < 3) {
        throw new Error("Некорректный ответ API");
      }

      const editions = json.data as Array<{
        number: number;
        name: string;
        englishName: string;
        englishNameTranslation: string;
        revelationType: string;
        numberOfAyahs: number;
        edition?: { identifier?: string };
        ayahs: Array<{
          number: number;
          numberInSurah: number;
          text: string;
          audio?: string;
          audioSecondary?: string[];
        }>;
      }>;

      const uthmani =
        editions.find((e) => e.edition?.identifier === "quran-uthmani") ?? editions[0];
      const kuliev =
        editions.find((e) => e.edition?.identifier === "ru.kuliev") ?? editions[1];
      const alafasy =
        editions.find((e) => e.edition?.identifier === reciter) ?? editions[2];

      const ruMap = new Map<number, string>();
      for (const a of kuliev.ayahs) {
        ruMap.set(a.numberInSurah, a.text);
      }

      const audioMap = new Map<number, string>();
      for (const a of alafasy.ayahs) {
        const audioUrl = a.audio || a.audioSecondary?.[0] || "";
        audioMap.set(a.numberInSurah, audioUrl);
      }

      const mergedAyahs: MergedAyah[] = uthmani.ayahs.map((a) => ({
        number: a.number,
        numberInSurah: a.numberInSurah,
        arabic: a.text,
        translation: ruMap.get(a.numberInSurah) ?? "",
        audio: audioMap.get(a.numberInSurah) ?? "",
      }));

      const details: SurahDetails = {
        number: uthmani.number,
        name: uthmani.name,
        englishName: uthmani.englishName,
        englishNameTranslation: uthmani.englishNameTranslation,
        revelationType: uthmani.revelationType,
        numberOfAyahs: uthmani.numberOfAyahs,
        ayahs: mergedAyahs,
      };

      setSurah(details);
      saveLastRead(details);
      try {
        localStorage.setItem(lsCacheKey, JSON.stringify(details));
      } catch {
        /* localStorage переполнен */
      }
    } catch (err) {
      const techMsg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      if (cachedDetails) {
        setSurah(cachedDetails);
        saveLastRead(cachedDetails);
        return;
      }
      // Резервный оффлайн-источник: пробуем достать суру из предкэшированных полных баз Корана
      try {
        if (typeof window !== "undefined" && "caches" in window) {
          const [arRes, ruRes] = await Promise.all([
            caches.match("https://api.alquran.cloud/v1/quran/quran-uthmani"),
            caches.match("https://api.alquran.cloud/v1/quran/ru.kuliev"),
          ]);
          if (arRes && ruRes) {
            const [arJson, ruJson] = await Promise.all([arRes.json(), ruRes.json()]);
            const arSurah = arJson?.data?.surahs?.find((s: { number: number }) => s.number === surahId);
            const ruSurah = ruJson?.data?.surahs?.find((s: { number: number }) => s.number === surahId);
            if (arSurah && ruSurah) {
              const ruMap = new Map<number, string>();
              for (const a of ruSurah.ayahs as Array<{ numberInSurah: number; text: string }>) {
                ruMap.set(a.numberInSurah, a.text);
              }
              const mergedAyahs: MergedAyah[] = (
                arSurah.ayahs as Array<{ number: number; numberInSurah: number; text: string }>
              ).map((a) => ({
                number: a.number,
                numberInSurah: a.numberInSurah,
                arabic: a.text,
                translation: ruMap.get(a.numberInSurah) ?? "",
                audio: `https://cdn.islamic.network/quran/audio/128/${reciter}/${a.number}.mp3`,
              }));
              const details: SurahDetails = {
                number: arSurah.number,
                name: arSurah.name,
                englishName: arSurah.englishName,
                englishNameTranslation: arSurah.englishNameTranslation,
                revelationType: arSurah.revelationType,
                numberOfAyahs: arSurah.ayahs.length,
                ayahs: mergedAyahs,
              };
              setSurah(details);
              saveLastRead(details);
              return;
            }
          }
        }
      } catch {
        /* ignore offline fallback error */
      }
      setError("Не удалось загрузить суру. Проверьте подключение к интернету.");
      setErrorDetails(`${techMsg} · URL: ${lastAttemptedUrl}`);
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, [surahId, saveLastRead, stopAudio, settings.reciter]);

  useEffect(() => {
    loadSurah();
  }, [loadSurah]);

  const currentFontClass =
    FONT_SIZES.find((f) => f.key === settings.fontSize)?.className ?? FONT_SIZES[1].className;
  const ruName = surah ? getSurahRuName(surah.number, surah.englishName) : `Сура №${surahId}`;
  const ruMeaning = surah ? getSurahRuMeaning(surah.number, surah.englishNameTranslation) : "";

  return (
    <main className={`space-y-4 px-4 pt-4 ${isDark ? "text-slate-100" : "text-stone-900"}`}>
      {/* Верхняя панель управления */}
      <div className={`sticky top-[env(safe-area-inset-top)] z-30 -mx-4 border-b px-4 py-3 backdrop-blur-lg ${
        isDark ? "border-emerald-900/40 bg-slate-950/95" : "border-stone-200 bg-white/95 shadow-sm"
      }`}>
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/quran"
            prefetch={false}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition active:scale-95 ${
              isDark
                ? "border-white/10 bg-slate-900/90 text-slate-200 hover:border-emerald-500/40 hover:text-emerald-300"
                : "border-stone-300 bg-stone-100 text-stone-700 hover:border-emerald-500/40 hover:text-emerald-800"
            }`}
          >
            <ArrowLeft className="h-4 w-4 text-emerald-500" />
            Назад к списку
          </Link>

          {/* Переключатель размера арабского шрифта */}
          <div
            role="group"
            aria-label="Размер арабского шрифта"
            className={`inline-flex rounded-xl p-1 ${isDark ? "bg-slate-900" : "bg-stone-200"}`}
          >
            {FONT_SIZES.map((f) => {
              const active = settings.fontSize === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => updateSetting("fontSize", f.key)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    active
                      ? "bg-emerald-500 text-slate-950 shadow"
                      : isDark ? "text-slate-400 hover:text-slate-200" : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Кнопка «Слушать всю суру подряд» */}
        <button
          type="button"
          onClick={togglePlayAll}
          disabled={!surah || loading}
          className={`mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition active:scale-[0.99] disabled:opacity-40 ${
            playAll && isPlaying
              ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
              : "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
          }`}
        >
          {playAll && isPlaying ? (
            <>
              <Pause className="h-4 w-4 fill-current" />
              Остановить воспроизведение суры (аят {activeAyah ?? 1} из {surah?.numberOfAyahs})
            </>
          ) : (
            <>
              <ListMusic className="h-4 w-4" />
              Слушать всю суру подряд
            </>
          )}
        </button>
      </div>

      {/* Скелетон загрузки */}
      {loading && (
        <div className="space-y-4">
          <div className="h-28 animate-pulse rounded-3xl border border-white/5 bg-slate-900/80" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-3xl border border-white/5 bg-slate-900/80"
            />
          ))}
        </div>
      )}

      {/* Ошибка */}
      {error && !loading && (
        <div className="rounded-3xl border border-amber-500/30 bg-slate-900/80 p-6 text-center">
          <p className="text-sm text-amber-300">{error}</p>
          {errorDetails && (
            <p className="mt-2 break-all font-mono text-[11px] text-amber-200/75">
              {errorDetails}
            </p>
          )}
          <button
            type="button"
            onClick={loadSurah}
            className="mx-auto mt-4 flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            <RefreshCw className="h-4 w-4" />
            Повторить загрузку
          </button>
        </div>
      )}

      {/* Содержимое суры */}
      {surah && !loading && (
        <>
          {/* Шапка суры */}
          <section className="overflow-hidden rounded-3xl border border-emerald-800/40 bg-gradient-to-br from-emerald-900/50 via-emerald-950/60 to-slate-900 p-5 text-center shadow-lg shadow-emerald-950/30">
            <span className="inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-medium text-emerald-300">
              Сура №{surah.number} · {formatRevelationType(surah.revelationType)} ·{" "}
              {formatAyahCount(surah.numberOfAyahs)}
            </span>
            <h1 className="mt-2 text-2xl font-bold text-white">{ruName}</h1>
            {ruMeaning && <p className="text-xs text-slate-300">«{ruMeaning}»</p>}
            <p dir="rtl" lang="ar" className="mt-2 font-arabic text-3xl text-emerald-300">
              {surah.name}
            </p>

            {/* Басмала перед сурами (кроме 1-й, где она внутри 1-го аята, и 9-й Ат-Тауба) */}
            {surah.number !== 1 && surah.number !== 9 && (
              <p
                dir="rtl"
                lang="ar"
                className="mt-4 border-t border-emerald-800/40 pt-4 font-arabic text-2xl text-emerald-200/90"
              >
                بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
              </p>
            )}
          </section>

          {/* Список аятов */}
          <ul className="space-y-3.5">
            {surah.ayahs.map((ayah) => {
              const isCurrent = activeAyah === ayah.numberInSurah;
              const isCurrentPlaying = isCurrent && isPlaying;
              const isCurrentLoading = isCurrent && audioLoading;

              return (
                <li key={ayah.numberInSurah} id={`ayah-${ayah.numberInSurah}`}>
                  <article
                    className={`rounded-3xl border p-5 transition ${
                      isCurrent
                        ? isDark
                          ? "border-emerald-500 bg-emerald-950/35 shadow-[0_0_25px_-8px] shadow-emerald-500/50"
                          : "border-emerald-500 bg-emerald-50/80 shadow-sm"
                        : isDark
                          ? "border-white/5 bg-slate-900/80 hover:border-emerald-500/30"
                          : "border-stone-200 bg-white hover:border-emerald-500/30 shadow-sm"
                    }`}
                  >
                    {/* Верхняя строка карточки: номер аята + кнопка Play/Pause */}
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tabular-nums ${
                          isCurrent
                            ? "bg-emerald-500 text-slate-950"
                            : isDark
                              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              : "border border-emerald-500/30 bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {surah.number}:{ayah.numberInSurah}
                        {isCurrentPlaying && <Volume2 className="h-3.5 w-3.5 animate-pulse" />}
                      </span>

                      <button
                        type="button"
                        onClick={() => playAyah(ayah.numberInSurah)}
                        aria-label={
                          isCurrentPlaying
                            ? `Пауза аята ${ayah.numberInSurah}`
                            : `Слушать аят ${ayah.numberInSurah}`
                        }
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition active:scale-95 ${
                          isCurrentPlaying
                            ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25"
                            : isDark
                              ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                              : "border border-emerald-500/30 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        {isCurrentLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isCurrentPlaying ? (
                          <Pause className="h-4 w-4 fill-current" />
                        ) : (
                          <Play className="h-4 w-4 fill-current" />
                        )}
                        {isCurrentPlaying ? "Пауза" : "Слушать"}
                      </button>
                    </div>

                    {/* Арабский текст аята справа налево шрифтом Amiri */}
                    <p
                      dir="rtl"
                      lang="ar"
                      className={`font-arabic text-right transition-all ${currentFontClass} ${isDark ? "text-white" : "text-stone-900"}`}
                    >
                      {ayah.arabic}
                    </p>

                    {/* Русский перевод Эльмира Кулиева */}
                    {settings.showTranslation && ayah.translation && (
                      <ScrollRevealTranslation>
                        <p className={`mt-4 border-t pt-3.5 text-[15px] leading-relaxed ${
                          isDark ? "border-white/5 text-slate-300" : "border-stone-200 text-stone-700"
                        }`}>
                          {ayah.translation}
                        </p>
                      </ScrollRevealTranslation>
                    )}
                  </article>
                </li>
              );
            })}
          </ul>

          {/* Навигация между соседними сурами */}
          <div className="flex items-center justify-between gap-3 pb-4 pt-2">
            {surah.number > 1 ? (
              <Link
                href={`/quran/${surah.number - 1}`}
                prefetch={false}
                className="flex flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-xs font-medium text-slate-300 transition hover:border-emerald-500/40 hover:text-emerald-300"
              >
                <ChevronLeft className="h-4 w-4 shrink-0 text-emerald-400" />
                <span className="truncate">
                  {surah.number - 1}. {getSurahRuName(surah.number - 1)}
                </span>
              </Link>
            ) : (
              <div className="flex-1" />
            )}

            {surah.number < 114 ? (
              <Link
                href={`/quran/${surah.number + 1}`}
                prefetch={false}
                className="flex flex-1 items-center justify-end gap-2 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-right text-xs font-medium text-slate-300 transition hover:border-emerald-500/40 hover:text-emerald-300"
              >
                <span className="truncate">
                  {surah.number + 1}. {getSurahRuName(surah.number + 1)}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-emerald-400" />
              </Link>
            ) : (
              <div className="flex-1" />
            )}
          </div>
        </>
      )}
    </main>
  );
}
