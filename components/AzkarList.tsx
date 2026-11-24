"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { AZKAR_CATEGORIES, type AzkarCategory, type Zikr } from "@/src/data/azkar";
import { useSettings, type FontSizeType, type AppSettings } from "@/src/context/SettingsContext";

const STORAGE_KEY = "noor:azkar-progress";
const TAB_KEY = "noor:azkar-tab";

const FONT_CLASSES: Record<FontSizeType, string> = {
  sm: "text-[1.35rem] leading-[2.0]",
  md: "text-[1.65rem] leading-[2.2]",
  lg: "text-[2.1rem] leading-[2.35]",
};

type Progress = Record<string, number>; // id -> оставшееся число повторений

/** Дата в локальном времени устройства — прогресс сбрасывается каждый новый день */
const today = () => new Date().toLocaleDateString("sv-SE");

function vibrate() {
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(25);
}

export default function AzkarList({ azkar }: { azkar: Zikr[] }) {
  const { settings } = useSettings();
  const isDark = settings.theme === "dark";
  const initial = useMemo<Progress>(() => Object.fromEntries(azkar.map((z) => [z.id, z.count])), [azkar]);

  const [tab, setTab] = useState<AzkarCategory>("morning");
  const [progress, setProgress] = useState<Progress>(initial);
  const [hydrated, setHydrated] = useState(false);

  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  // Загрузка сохранённого прогресса (только на клиенте — без рассинхрона гидратации)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved?.date === today() && saved.progress) {
        setProgress({ ...initial, ...saved.progress });
      }
      const savedTab = localStorage.getItem(TAB_KEY) as AzkarCategory | null;
      if (savedTab && AZKAR_CATEGORIES.some((c) => c.key === savedTab)) setTab(savedTab);
    } catch {
      /* повреждённые данные — начинаем заново */
    }
    setHydrated(true);
  }, [initial]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today(), progress }));
  }, [progress, hydrated]);

  const selectTab = (key: AzkarCategory) => {
    if (key === tab) return;
    setTab(key);
    localStorage.setItem(TAB_KEY, key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const progressRef = useRef(progress);
  progressRef.current = progress;

  const list = useMemo(() => azkar.filter((z) => z.category === tab), [azkar, tab]);
  const listRef = useRef(list);
  listRef.current = list;

  const decrement = useCallback(
    (id: string) => {
      const currentRemaining = progressRef.current[id] ?? 0;
      if (currentRemaining <= 0) return;

      if (settings.vibration) vibrate();
      const nextRemaining = Math.max(0, currentRemaining - 1);

      setProgress((prev) => ({ ...prev, [id]: nextRemaining }));

      // Если карточка только что завершилась (✓ Выполнено) — мягкий автоскролл к следующей невыполненной
      if (nextRemaining === 0) {
        const currentList = listRef.current;
        const currentIndex = currentList.findIndex((z) => z.id === id);
        if (currentIndex !== -1) {
          const nextIncomplete =
            currentList.slice(currentIndex + 1).find((z) => (progressRef.current[z.id] ?? z.count) > 0) ||
            currentList.slice(0, currentIndex).find((z) => (progressRef.current[z.id] ?? z.count) > 0);

          if (nextIncomplete) {
            setTimeout(() => {
              const el = cardRefs.current[nextIncomplete.id];
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }, 260);
          }
        }
      }
    },
    [settings.vibration]
  );

  const resetCurrentTab = () => {
    setProgress((prev) => {
      const updated = { ...prev };
      for (const z of list) {
        updated[z.id] = z.count;
      }
      return updated;
    });
    if (settings.vibration) vibrate();
  };

  const stats = useMemo(() => {
    const result = {} as Record<AzkarCategory, { done: number; total: number }>;
    for (const c of AZKAR_CATEGORIES) result[c.key] = { done: 0, total: 0 };
    for (const z of azkar) {
      result[z.category].total++;
      if (progress[z.id] === 0) result[z.category].done++;
    }
    return result;
  }, [azkar, progress]);

  const isTabDirty = list.some((z) => (progress[z.id] ?? z.count) !== z.count);
  const currentStats = stats[tab];

  return (
    <div className="pb-6">
      {/* Вкладки-фильтры */}
      <div
        className={`sticky top-[env(safe-area-inset-top)] z-20 -mx-4 px-4 pb-3 pt-2 backdrop-blur-lg transition-colors ${
          isDark ? "bg-slate-950/90" : "bg-stone-100/90"
        }`}
      >
        <div
          role="tablist"
          className={`grid grid-cols-4 gap-1 rounded-2xl p-1 ${
            isDark ? "bg-slate-900" : "bg-stone-200"
          }`}
        >
          {AZKAR_CATEGORIES.map(({ key, label }) => {
            const active = key === tab;
            const s = stats[key];
            const complete = s.total > 0 && s.done === s.total;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={active}
                onClick={() => selectTab(key)}
                className={`rounded-xl px-1.5 py-2 text-xs font-medium transition-all duration-200 ${
                  active
                    ? "bg-emerald-500 text-slate-950 shadow-md scale-[1.01]"
                    : isDark
                    ? "text-slate-400 hover:text-slate-200"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <span className="block leading-tight">{label}</span>
                <span
                  className={`mt-0.5 flex items-center justify-center gap-0.5 text-[11px] tabular-nums ${
                    active
                      ? "text-emerald-950/75"
                      : complete
                      ? "font-semibold text-emerald-500"
                      : isDark
                      ? "text-slate-500"
                      : "text-stone-500"
                  }`}
                >
                  {complete && <Check className="h-3 w-3" />}
                  {s.done}/{s.total}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Верхняя панель прогресса и кнопка «Сбросить прогресс» */}
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <span className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-stone-500"}`}>
          Выполнено: <strong className="text-emerald-500">{currentStats.done}</strong> из {currentStats.total}
        </span>
        <button
          type="button"
          onClick={resetCurrentTab}
          disabled={!isTabDirty}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-40 ${
            isDark
              ? "border-slate-800 bg-slate-900/80 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-400"
              : "border-stone-200 bg-white text-stone-700 hover:border-emerald-500/40 hover:text-emerald-600 shadow-xs"
          }`}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Сбросить прогресс
        </button>
      </div>

      {/* Карточки зикров с плавным появлением при смене вкладки */}
      <ul
        key={tab}
        className="space-y-4 animate-[fadeIn_0.25s_ease-out]"
      >
        {list.map((z) => (
          <li
            key={z.id}
            ref={(el) => {
              cardRefs.current[z.id] = el;
            }}
          >
            <ZikrCard
              zikr={z}
              remaining={progress[z.id] ?? z.count}
              onTap={decrement}
              settings={settings}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

const ZikrCard = memo(function ZikrCard({
  zikr,
  remaining,
  onTap,
  settings,
}: {
  zikr: Zikr;
  remaining: number;
  onTap: (id: string) => void;
  settings: AppSettings;
}) {
  const isDark = settings.theme === "dark";
  const done = remaining === 0;
  const completedCount = zikr.count - remaining;
  const progressRatio = zikr.count > 0 ? completedCount / zikr.count : 1;
  const progressPct = progressRatio * 100;
  const fontClass = FONT_CLASSES[settings.fontSize] || FONT_CLASSES.md;

  const [glow, setGlow] = useState(false);
  const pointerDownRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const triggerTap = () => {
    if (done) return;
    setGlow(true);
    onTap(zikr.id);
    setTimeout(() => setGlow(false), 260);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    pointerDownRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
  };

  /** Отсчёт только по короткому чёткому тапу по кнопке счётчика — не при скролле и не при выделении текста */
  const handleCounterClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const selection = typeof window !== "undefined" ? window.getSelection()?.toString() : "";
    if (selection && selection.trim().length > 0) return;

    const start = pointerDownRef.current;
    pointerDownRef.current = null;
    if (start) {
      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);
      const dt = Date.now() - start.time;
      if (dx > 10 || dy > 10 || dt > 600) return;
    }

    triggerTap();
  };

  // Параметры SVG-кольца прогресса
  const size = 64;
  const strokeWidth = 4.5;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progressRatio);

  return (
    <article
      className={`relative overflow-hidden rounded-3xl border p-5 transition-all duration-200 ease-in-out ${
        glow
          ? "border-emerald-400 ring-2 ring-emerald-500/40 shadow-[0_0_24px_rgba(16,185,129,0.28)]"
          : done
          ? isDark
            ? "border-emerald-500/50 bg-emerald-950/25"
            : "border-emerald-500/40 bg-emerald-50/80"
          : isDark
          ? "border-white/5 bg-slate-900/70 hover:border-emerald-500/30"
          : "border-stone-200 bg-white hover:border-emerald-500/40 shadow-sm"
      }`}
    >
      {/* Верхняя тонкая полоска прогресса */}
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 ${isDark ? "bg-slate-800" : "bg-stone-200"}`}>
        <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-500">{zikr.title}</h2>
        {done && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-semibold text-slate-950 shadow-xs">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
            Выполнено
          </span>
        )}
      </div>

      <div className={`transition-opacity duration-200 ${done ? "opacity-60" : ""}`}>
        <p
          dir="rtl"
          lang="ar"
          className={`font-arabic text-right leading-[2.2] ${fontClass} ${isDark ? "text-white" : "text-stone-900"}`}
        >
          {zikr.arabic}
        </p>
        {settings.showTranscription && zikr.transcription && (
          <p
            className={`mt-4 whitespace-pre-line text-[15px] italic leading-relaxed ${
              isDark ? "text-emerald-100/80" : "text-emerald-800"
            }`}
          >
            {zikr.transcription}
          </p>
        )}
        {settings.showTranslation && zikr.translation && (
          <p
            className={`mt-2 whitespace-pre-line text-[15px] leading-relaxed ${
              isDark ? "text-slate-300" : "text-stone-700"
            }`}
          >
            {zikr.translation}
          </p>
        )}
      </div>

      {/* Нижняя панель карточки с источником слева и круговой кнопкой-счётчиком (SVG-кольцом) в правом нижнем углу */}
      <div className="mt-5 flex items-end justify-between gap-3 pt-2">
        <div className="min-w-0 flex-1">
          {zikr.source ? (
            <p className={`text-xs ${isDark ? "text-slate-500" : "text-stone-400"}`}>{zikr.source}</p>
          ) : (
            <span className={`text-xs ${isDark ? "text-slate-500" : "text-stone-400"}`}>
              {done ? "Зикр завершён" : "Нажмите на счётчик"}
            </span>
          )}
        </div>

        <button
          type="button"
          onPointerDown={handlePointerDown}
          onClick={handleCounterClick}
          disabled={done}
          aria-label={done ? "Выполнено" : `Осталось ${remaining} из ${zikr.count}`}
          className={`group relative flex h-16 w-16 shrink-0 touch-manipulation select-none items-center justify-center rounded-full transition-all duration-200 ease-in-out active:scale-90 ${
            done
              ? "bg-emerald-500/20 text-emerald-400"
              : isDark
              ? "bg-slate-800/90 text-white shadow-lg shadow-emerald-950/50 hover:bg-slate-800"
              : "bg-emerald-50 text-stone-900 shadow-md shadow-emerald-500/10 hover:bg-emerald-100/80"
          }`}
        >
          <svg className="pointer-events-none absolute inset-0 -rotate-90" width={size} height={size}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className={isDark ? "text-slate-700/70" : "text-emerald-200"}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="text-emerald-500 transition-all duration-300 ease-out"
            />
          </svg>

          {done ? (
            <Check className="h-6 w-6 text-emerald-400" strokeWidth={3} />
          ) : (
            <div className="flex flex-col items-center justify-center leading-none tabular-nums">
              <span className="text-sm font-bold text-emerald-400">
                {remaining} <span className={`text-[11px] font-medium ${isDark ? "text-slate-400" : "text-stone-500"}`}>/ {zikr.count}</span>
              </span>
            </div>
          )}
        </button>
      </div>
    </article>
  );
});
