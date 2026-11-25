"use client";

import {
  memo,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BookMarked,
  Check,
  Copy,
  Heart,
  RefreshCw,
  ScrollText,
  Search,
  X,
} from "lucide-react";
import nawawiFallback from "@/src/data/nawawi-ru.json";
import { useSettings } from "@/src/context/SettingsContext";

type CollectionKey = "nawawi" | "bukhari" | "favorites";
type RemoteCollectionKey = "nawawi" | "bukhari";

interface RawHadith {
  hadithnumber?: number | string;
  text?: string;
  title?: string;
}

interface HadithItem {
  uid: string;
  collection: RemoteCollectionKey;
  collectionLabel: string;
  hadithnumber: number;
  title?: string;
  text: string;
}

const PAGE_SIZE = 20;
const FAVORITES_STORAGE_KEY = "noor:favorite-hadiths";

const COLLECTIONS: {
  key: CollectionKey;
  label: string;
  shortLabel: string;
  url?: string;
}[] = [
  {
    key: "nawawi",
    label: "40 хадисов ан-Навави",
    shortLabel: "Ан-Навави",
    url: "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/rus-nawawi.min.json",
  },
  {
    key: "bukhari",
    label: "Сахих аль-Бухари",
    shortLabel: "Аль-Бухари",
    url: "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/rus-bukhari.min.json",
  },
  {
    key: "favorites",
    label: "Избранное",
    shortLabel: "Избранное",
  },
];

function normalizeText(text: string): string {
  return text.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
}

function parseHadiths(
  rawList: RawHadith[] | undefined,
  collection: RemoteCollectionKey,
  collectionLabel: string
): HadithItem[] {
  if (!Array.isArray(rawList)) return [];

  const result: HadithItem[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    if (!item || typeof item.text !== "string") continue;

    const clean = normalizeText(item.text);
    if (!clean) continue;

    const num = Number(item.hadithnumber) || i + 1;
    const baseUid = `${collection}-${num}`;
    const uid = seen.has(baseUid) ? `${baseUid}-${i}` : baseUid;
    seen.add(uid);

    result.push({
      uid,
      collection,
      collectionLabel,
      hadithnumber: num,
      title: item.title,
      text: clean,
    });
  }

  return result;
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* переходим на резервный способ */
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export default function HadithsPage() {
  const { settings } = useSettings();
  const isDark = settings.theme === "dark";

  const [activeTab, setActiveTab] = useState<CollectionKey>("nawawi");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Кэш загруженных сборников в памяти, чтобы не скачивать Бухари повторно при переключении вкладок
  const cacheRef = useRef<Partial<Record<RemoteCollectionKey, HadithItem[]>>>({});
  const [items, setItems] = useState<HadithItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Избранное в localStorage
  const [favorites, setFavorites] = useState<HadithItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollYRef = useRef(0);

  // Плавное скрытие шапки со вкладками и поиском при скролле вниз и появление при скролле вверх
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY;
          const prevY = lastScrollYRef.current;
          const delta = currentY - prevY;

          if (currentY <= 30) {
            setShowHeader(true);
          } else if (delta > 8 && currentY > 60) {
            setShowHeader(false);
          } else if (delta < -8) {
            setShowHeader(true);
          }

          lastScrollYRef.current = currentY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Индикатор копирования
  const [copiedUid, setCopiedUid] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) ?? "[]");
      if (Array.isArray(saved)) {
        setFavorites(saved);
      }
    } catch {
      /* повреждённые данные — начинаем с пустого избранного */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites, hydrated]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      setCopiedUid(null);
    }, 2000);
  }, []);

  const loadCollection = useCallback(async (key: RemoteCollectionKey, force = false) => {
    setError(null);
    setNotice(null);

    if (!force && cacheRef.current[key]) {
      setItems(cacheRef.current[key]!);
      setLoading(false);
      return;
    }

    const meta = COLLECTIONS.find((c) => c.key === key);
    if (!meta?.url) return;

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(meta.url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const parsed = parseHadiths(data?.hadiths, key, meta.label);
      if (parsed.length === 0) throw new Error("Пустой список хадисов");

      cacheRef.current[key] = parsed;
      setItems(parsed);
    } catch {
      if (key === "nawawi") {
        // В репозитории fawazahmed0/hadith-api@1 отсутствует файл rus-nawawi.min.json (404),
        // поэтому используем встроенную полную базу из 42 хадисов ан-Навави на русском языке.
        const fallback = parseHadiths(
          nawawiFallback.hadiths as RawHadith[],
          "nawawi",
          meta.label
        );
        cacheRef.current.nawawi = fallback;
        setItems(fallback);
        setNotice("Загружена встроенная русская редакция сборника (42 хадиса)");
      } else {
        setItems([]);
        setError("Не удалось загрузить сборник хадисов. Проверьте подключение к интернету.");
      }
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    if (activeTab === "favorites") {
      setLoading(false);
      setError(null);
      setNotice(null);
      return;
    }
    loadCollection(activeTab);
  }, [activeTab, loadCollection]);

  // Сброс пагинации при изменении поискового запроса
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [deferredQuery]);

  const favoriteSet = useMemo(() => new Set(favorites.map((f) => f.uid)), [favorites]);

  const toggleFavorite = useCallback((hadith: HadithItem) => {
    setFavorites((prev) => {
      const exists = prev.some((item) => item.uid === hadith.uid);
      if (exists) {
        return prev.filter((item) => item.uid !== hadith.uid);
      }
      return [hadith, ...prev];
    });
  }, []);

  const handleCopy = useCallback(
    async (hadith: HadithItem) => {
      const header = `${hadith.collectionLabel} — Хадис №${hadith.hadithnumber}${
        hadith.title ? ` (${hadith.title})` : ""
      }`;
      const ok = await copyToClipboard(`${header}\n\n${hadith.text}`);
      if (ok) {
        setCopiedUid(hadith.uid);
        showToast("Скопировано");
      } else {
        showToast("Не удалось скопировать");
      }
    },
    [showToast]
  );

  const sourceList = activeTab === "favorites" ? favorites : items;

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return sourceList;

    const cleanNum = q.replace(/^№/, "").trim();
    const isNumeric = /^\d+$/.test(cleanNum);

    return sourceList.filter((h) => {
      if (isNumeric && String(h.hadithnumber) === cleanNum) return true;
      return (
        String(h.hadithnumber).includes(cleanNum) ||
        h.text.toLowerCase().includes(q) ||
        (h.title ? h.title.toLowerCase().includes(q) : false)
      );
    });
  }, [sourceList, deferredQuery]);

  const visibleHadiths = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  const hasMore = visibleCount < filtered.length;
  const remaining = filtered.length - visibleHadiths.length;

  return (
    <main className={`space-y-4 px-4 pt-6 ${isDark ? "text-slate-100" : "text-stone-900"}`}>
      <header className="flex items-center justify-center">
        <h1 className={`text-3xl font-bold ${isDark ? "text-white" : "text-stone-900"}`}>Хадисы</h1>
      </header>

      {/* Переключатель сборников + строка поиска */}
      <div className={`sticky top-[env(safe-area-inset-top)] z-20 -mx-4 space-y-2.5 px-4 pb-3 pt-2 backdrop-blur-xl transition-all duration-300 ease-in-out will-change-[transform,opacity] ${
        isDark ? "bg-slate-950/95" : "bg-stone-100/95"
      } ${
        showHeader
          ? "translate-y-0 opacity-100"
          : "-translate-y-[calc(100%+env(safe-area-inset-top)+14px)] opacity-0 pointer-events-none"
      }`}>
        <div role="tablist" className={`grid grid-cols-3 gap-1 rounded-2xl p-1 ${
          isDark ? "bg-slate-900" : "bg-stone-200"
        }`}>
          {COLLECTIONS.map(({ key, shortLabel }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  if (key === activeTab) return;
                  setShowHeader(true);
                  startTransition(() => setActiveTab(key));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-semibold transition ${
                  active
                    ? "bg-emerald-500 text-slate-950 shadow"
                    : isDark ? "text-slate-400 hover:text-slate-200" : "text-stone-600 hover:text-stone-900"
                }`}
              >
                {key === "favorites" && (
                  <Heart
                    className={`h-3.5 w-3.5 ${
                      active ? "fill-slate-950" : favorites.length > 0 ? "text-emerald-500" : ""
                    }`}
                  />
                )}
                <span className="truncate">{shortLabel}</span>
                {key === "favorites" && favorites.length > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] tabular-nums ${
                      active
                        ? "bg-slate-950/20 text-slate-950"
                        : "bg-emerald-500/20 text-emerald-600"
                    }`}
                  >
                    {favorites.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowHeader(true)}
            placeholder="Поиск по ключевому слову или номеру хадиса..."
            aria-label="Поиск хадисов"
            className={`w-full rounded-2xl border py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 ${
              isDark
                ? "border-white/10 bg-slate-900/90 text-white placeholder-slate-500"
                : "border-stone-300 bg-white text-stone-900 placeholder-stone-400"
            }`}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Очистить поиск"
              className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 ${
                isDark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-stone-400 hover:bg-stone-200 hover:text-stone-900"
              }`}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Сводка по текущему сборнику */}
      {!loading && !error && sourceList.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span className="font-medium text-emerald-300/90">
            {COLLECTIONS.find((c) => c.key === activeTab)?.label}
          </span>
          <span className="tabular-nums">
            Показано {visibleHadiths.length} из {filtered.length}
          </span>
        </div>
      )}

      {notice && !loading && activeTab === "nawawi" && (
        <p className="rounded-xl border border-emerald-500/20 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300/80">
          {notice}
        </p>
      )}

      {/* Скелетон загрузки */}
      {loading && (
        <div className="space-y-3.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-3xl border border-white/5 bg-slate-900/80"
            />
          ))}
        </div>
      )}

      {/* Ошибка сети */}
      {error && !loading && activeTab !== "favorites" && (
        <div className="rounded-3xl border border-amber-500/30 bg-slate-900/80 p-6 text-center">
          <p className="text-sm text-amber-300">{error}</p>
          <button
            type="button"
            onClick={() => loadCollection(activeTab, true)}
            className="mx-auto mt-4 flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            <RefreshCw className="h-4 w-4" />
            Повторить загрузку
          </button>
        </div>
      )}

      {/* Пустое избранное */}
      {!loading && activeTab === "favorites" && favorites.length === 0 && (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-emerald-800/50 bg-slate-900/40 px-6 py-14 text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
            <BookMarked className="h-7 w-7" />
          </span>
          <p className="text-sm font-medium text-slate-200">В избранном пока нет хадисов</p>
          <p className="mt-1 text-xs text-slate-500">
            Нажмите на сердечко в карточке хадиса, чтобы сохранить его сюда
          </p>
        </div>
      )}

      {/* Ничего не найдено по поиску */}
      {!loading && !error && sourceList.length > 0 && filtered.length === 0 && (
        <div className="flex flex-col items-center rounded-3xl border border-white/5 bg-slate-900/60 px-6 py-12 text-center">
          <ScrollText className="mb-2 h-8 w-8 text-slate-600" />
          <p className="text-sm text-slate-400">По запросу «{query}» ничего не найдено</p>
        </div>
      )}

      {/* Список карточек хадисов */}
      {!loading && visibleHadiths.length > 0 && (
        <>
          <ul className="space-y-3.5">
            {visibleHadiths.map((hadith) => (
              <li key={hadith.uid}>
                <HadithCard
                  hadith={hadith}
                  isFav={favoriteSet.has(hadith.uid)}
                  isCopied={copiedUid === hadith.uid}
                  isDark={isDark}
                  showCollection={activeTab === "favorites"}
                  onToggleFavorite={toggleFavorite}
                  onCopy={handleCopy}
                />
              </li>
            ))}
          </ul>

          {/* Кнопка «Показать ещё» по 20 хадисов */}
          {hasMore && (
            <div className="pb-4 pt-2 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="w-full rounded-2xl border border-emerald-500/40 bg-emerald-500/15 px-5 py-3.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/25 active:scale-[0.99]"
              >
                Показать ещё {Math.min(PAGE_SIZE, remaining)} (осталось {remaining})
              </button>
            </div>
          )}
        </>
      )}

      {/* Всплывающее уведомление «Скопировано» */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-emerald-950/60"
        >
          <Check className="h-4 w-4" strokeWidth={3} />
          {toast}
        </div>
      )}
    </main>
  );
}

/** Карточка хадиса — мемоизирована: перерисовывается только при изменении своих данных */
const HadithCard = memo(function HadithCard({
  hadith,
  isFav,
  isCopied,
  isDark,
  showCollection,
  onToggleFavorite,
  onCopy,
}: {
  hadith: HadithItem;
  isFav: boolean;
  isCopied: boolean;
  isDark: boolean;
  showCollection: boolean;
  onToggleFavorite: (hadith: HadithItem) => void;
  onCopy: (hadith: HadithItem) => void;
}) {
  return (
    <article className={`rounded-3xl border p-5 transition-all duration-200 ease-in-out ${
      isDark
        ? "border-white/5 bg-slate-900/80 hover:border-emerald-500/30"
        : "border-stone-200 bg-white hover:border-emerald-500/40 shadow-sm"
    }`}>
      {/* Шапка карточки: номер, сборник и действия */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold tabular-nums ${
              isDark
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-emerald-500/30 bg-emerald-50 text-emerald-700"
            }`}>
              Хадис №{hadith.hadithnumber}
            </span>
            {showCollection && (
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                isDark ? "bg-slate-800 text-slate-300" : "bg-stone-200 text-stone-700"
              }`}>
                {hadith.collectionLabel}
              </span>
            )}
          </div>
          {hadith.title && (
            <h2 className={`mt-2 text-sm font-semibold ${isDark ? "text-white" : "text-stone-900"}`}>
              {hadith.title}
            </h2>
          )}
        </div>

        <button
          type="button"
          onClick={() => onToggleFavorite(hadith)}
          aria-label={isFav ? "Удалить из избранного" : "Сохранить в избранное"}
          aria-pressed={isFav}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all duration-200 ease-in-out active:scale-90 ${
            isFav
              ? isDark ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400" : "border-emerald-500/50 bg-emerald-50 text-emerald-600"
              : isDark ? "border-white/10 bg-slate-950/60 text-slate-400 hover:border-emerald-500/40 hover:text-emerald-300" : "border-stone-300 bg-stone-50 text-stone-500 hover:border-emerald-500/40 hover:text-emerald-700"
          }`}
        >
          <Heart
            className={`h-4 w-4 ${isFav ? (isDark ? "fill-emerald-400 text-emerald-400" : "fill-emerald-600 text-emerald-600") : ""}`}
          />
        </button>
      </div>

      {/* Текст хадиса */}
      <p className={`whitespace-pre-line text-[15px] leading-relaxed ${isDark ? "text-slate-200" : "text-stone-800"}`}>
        {hadith.text}
      </p>

      {/* Нижняя панель действий */}
      <div className={`mt-4 flex items-center justify-between gap-2 border-t pt-3 ${
        isDark ? "border-white/5" : "border-stone-200"
      }`}>
        <button
          type="button"
          onClick={() => onCopy(hadith)}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-200 ease-in-out active:scale-95 ${
            isCopied
              ? "bg-emerald-500 text-slate-950"
              : isDark
                ? "border border-white/10 bg-slate-950/60 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300"
                : "border border-stone-300 bg-stone-100 text-stone-700 hover:border-emerald-500/40 hover:text-emerald-800"
          }`}
        >
          {isCopied ? (
            <>
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              Скопировано
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Скопировать текст
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => onToggleFavorite(hadith)}
          className={`text-xs transition-all duration-200 ease-in-out ${isDark ? "text-slate-400 hover:text-emerald-300" : "text-stone-500 hover:text-emerald-700"}`}
        >
          {isFav ? "В избранном" : "В закладки"}
        </button>
      </div>
    </article>
  );
});
