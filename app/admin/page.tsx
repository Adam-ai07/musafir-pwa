"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  KeyRound,
  Lock,
  LogOut,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  User,
} from "lucide-react";
import {
  addTicketReply,
  deleteTicket,
  getAdminPin,
  getCustomCloudUrl,
  getLocalTickets,
  setAdminPin,
  setCustomCloudUrl,
  subscribeFeedbackUpdates,
  syncFeedbackDatabase,
  updateTicketStatus,
  type FeedbackStatus,
  type FeedbackTicket,
} from "@/src/lib/feedbackDb";
import { useSettings } from "@/src/context/SettingsContext";

const SESSION_AUTH_KEY = "musafir:admin-authenticated";

const CATEGORY_LABELS: Record<string, string> = {
  question: "Вопрос",
  suggestion: "Предложение",
  bug: "Ошибка",
};

export default function AdminFeedbackPage() {
  const { settings } = useSettings();
  const isDark = settings.theme === "dark";

  const [authenticated, setAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<"all" | FeedbackStatus>("all");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  // Настройки безопасности и БД
  const [showDbConfig, setShowDbConfig] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [cloudUrl, setCloudUrl] = useState("");
  const [configSavedMsg, setConfigSavedMsg] = useState<string | null>(null);

  const loadTickets = useCallback(() => {
    setTickets(getLocalTickets());
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const merged = await syncFeedbackDatabase();
      setTickets(merged);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (sessionStorage.getItem(SESSION_AUTH_KEY) === "1") {
        setAuthenticated(true);
      }
      setCloudUrl(getCustomCloudUrl());
    }
    loadTickets();
    void handleSync();
    return subscribeFeedbackUpdates(loadTickets);
  }, [loadTickets, handleSync]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const validPin = getAdminPin();
    if (pinInput.trim() === validPin) {
      setAuthenticated(true);
      setPinError(false);
      sessionStorage.setItem(SESSION_AUTH_KEY, "1");
      void handleSync();
    } else {
      setPinError(true);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_AUTH_KEY);
    setAuthenticated(false);
    setPinInput("");
  };

  const handleSendReply = async (ticketId: string) => {
    const text = (replyDrafts[ticketId] || "").trim();
    if (!text) return;
    setReplyDrafts((prev) => ({ ...prev, [ticketId]: "" }));
    await addTicketReply({ ticketId, author: "admin", text });
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.trim().length >= 4) {
      setAdminPin(newPin.trim());
      setNewPin("");
    }
    setCustomCloudUrl(cloudUrl);
    setConfigSavedMsg("Настройки сохранены");
    setTimeout(() => setConfigSavedMsg(null), 2000);
  };

  const filteredTickets = useMemo(() => {
    if (filter === "all") return tickets;
    return tickets.filter((t) => t.status === filter);
  }, [tickets, filter]);

  const stats = useMemo(() => {
    return {
      total: tickets.length,
      open: tickets.filter((t) => t.status === "open").length,
      answered: tickets.filter((t) => t.status === "answered").length,
      closed: tickets.filter((t) => t.status === "closed").length,
    };
  }, [tickets]);

  const cardClass = isDark
    ? "border-slate-800 bg-slate-900/90 text-slate-100"
    : "border-stone-200 bg-white text-stone-900 shadow-sm";

  // Экран входа по PIN-коду владельца
  if (!authenticated) {
    return (
      <main className="px-4 pt-10">
        <div className={`mx-auto max-w-sm rounded-3xl border p-6 space-y-5 ${cardClass}`}>
          <div className="flex flex-col items-center text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500">
              <Lock className="h-7 w-7" />
            </span>
            <h1 className="text-xl font-bold">Админ-панель</h1>
            <p className={`mt-1 text-xs ${isDark ? "text-slate-400" : "text-stone-500"}`}>
              Закрытый раздел владельца для просмотра обращений и ответов пользователям
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <input
                type="password"
                inputMode="numeric"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(false);
                }}
                placeholder="Введите PIN-код (по умолчанию 0707)"
                className={`w-full rounded-2xl border px-4 py-3 text-center text-sm tracking-widest outline-none focus:border-emerald-500 ${
                  isDark
                    ? "border-slate-800 bg-slate-950 text-white placeholder-slate-500"
                    : "border-stone-200 bg-stone-50 text-stone-900 placeholder-stone-400"
                }`}
              />
              {pinError && (
                <p className="mt-1.5 text-center text-xs text-red-400">Неверный PIN-код</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-slate-950 shadow-md shadow-emerald-500/20 hover:bg-emerald-400"
            >
              Войти в панель
            </button>
          </form>

          <div className="text-center">
            <Link
              href="/settings"
              className={`inline-flex items-center gap-1.5 text-xs ${
                isDark ? "text-slate-400 hover:text-white" : "text-stone-500 hover:text-stone-900"
              }`}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Вернуться в настройки
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-4 px-4 pt-6 pb-10">
      {/* Шапка админ-панели */}
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Link
            href="/settings"
            className={`rounded-xl border p-2 ${
              isDark
                ? "border-slate-800 bg-slate-900 text-slate-300 hover:text-white"
                : "border-stone-200 bg-white text-stone-700"
            }`}
            aria-label="Назад"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Обращения</h1>
            <p className={`text-[11px] ${isDark ? "text-slate-400" : "text-stone-500"}`}>
              База данных синхронизирована (IndexedDB + Облако)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            title="Обновить из облачной БД"
            className={`rounded-xl border p-2 ${
              isDark
                ? "border-slate-800 bg-slate-900 text-emerald-400 hover:bg-slate-800"
                : "border-stone-200 bg-white text-emerald-600"
            }`}
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => setShowDbConfig((v) => !v)}
            title="Настройки PIN и БД"
            className={`rounded-xl border p-2 ${
              isDark
                ? "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
                : "border-stone-200 bg-white text-stone-700"
            }`}
          >
            <Database className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            title="Выйти"
            className={`rounded-xl border p-2 ${
              isDark
                ? "border-slate-800 bg-slate-900 text-red-400 hover:bg-slate-800"
                : "border-stone-200 bg-white text-red-600"
            }`}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Настройки PIN-кода и внешней БД */}
      {showDbConfig && (
        <form
          onSubmit={handleSaveConfig}
          className={`rounded-2xl border p-4 space-y-3 animate-[fadeIn_0.2s_ease-out] ${cardClass}`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-500">
            <KeyRound className="h-4 w-4" />
            <span>Безопасность и подключение БД</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <input
              type="password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="Новый PIN-код (мин. 4 символа)"
              className={`rounded-xl border px-3 py-2 text-xs outline-none focus:border-emerald-500 ${
                isDark
                  ? "border-slate-800 bg-slate-950 text-white"
                  : "border-stone-200 bg-stone-50 text-stone-900"
              }`}
            />
            <input
              type="url"
              value={cloudUrl}
              onChange={(e) => setCloudUrl(e.target.value)}
              placeholder="Кастомный REST URL БД (необязательно)"
              className={`rounded-xl border px-3 py-2 text-xs outline-none focus:border-emerald-500 ${
                isDark
                  ? "border-slate-800 bg-slate-950 text-white"
                  : "border-stone-200 bg-stone-50 text-stone-900"
              }`}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-emerald-400">{configSavedMsg}</span>
            <button
              type="submit"
              className="rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Сохранить
            </button>
          </div>
        </form>
      )}

      {/* Фильтры по статусу */}
      <div
        className={`grid grid-cols-4 gap-1 rounded-2xl p-1 ${
          isDark ? "bg-slate-900" : "bg-stone-200"
        }`}
      >
        {(
          [
            { key: "all", label: "Все", count: stats.total },
            { key: "open", label: "Новые", count: stats.open },
            { key: "answered", label: "Отвечено", count: stats.answered },
            { key: "closed", label: "Закрыто", count: stats.closed },
          ] as const
        ).map((tab) => {
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`rounded-xl py-2 text-xs font-semibold transition ${
                active
                  ? "bg-emerald-500 text-slate-950 shadow-xs"
                  : isDark
                  ? "text-slate-400 hover:text-slate-200"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <span>{tab.label}</span>{" "}
              <span className="text-[10px] opacity-75">({tab.count})</span>
            </button>
          );
        })}
      </div>

      {/* Список обращений */}
      {filteredTickets.length === 0 ? (
        <div className={`rounded-3xl border py-14 text-center ${cardClass}`}>
          <MessageSquare className="mx-auto mb-2 h-8 w-8 text-slate-500" />
          <p className="text-sm font-medium">Обращений в этой категории пока нет</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredTickets.map((ticket) => (
            <article
              key={ticket.id}
              className={`rounded-3xl border p-4 space-y-3 ${cardClass}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{ticket.name}</span>
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                      {CATEGORY_LABELS[ticket.category] || ticket.category}
                    </span>
                  </div>
                  {ticket.contact && (
                    <p className="mt-0.5 text-xs text-emerald-400">Контакт: {ticket.contact}</p>
                  )}
                  <p className={`text-[11px] ${isDark ? "text-slate-500" : "text-stone-400"}`}>
                    {new Date(ticket.createdAt).toLocaleString("ru-RU")}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      updateTicketStatus(
                        ticket.id,
                        ticket.status === "closed" ? "open" : "closed"
                      )
                    }
                    className={`rounded-xl border px-2.5 py-1 text-[11px] font-medium ${
                      ticket.status === "closed"
                        ? "border-amber-500/40 text-amber-400"
                        : "border-emerald-500/40 text-emerald-400"
                    }`}
                  >
                    {ticket.status === "closed" ? "Открыть" : "Завершить"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTicket(ticket.id)}
                    aria-label="Удалить обращение"
                    className="rounded-xl border border-red-500/30 p-1.5 text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Текст обращения пользователя */}
              <div
                className={`rounded-2xl p-3 text-sm whitespace-pre-line ${
                  isDark ? "bg-slate-950/70 text-slate-200" : "bg-stone-100 text-stone-800"
                }`}
              >
                {ticket.message}
              </div>

              {/* Переписка / ответы */}
              {ticket.replies && ticket.replies.length > 0 && (
                <div className="space-y-2 pl-2 border-l-2 border-emerald-500/40">
                  {ticket.replies.map((r) => (
                    <div
                      key={r.id}
                      className={`rounded-xl p-2.5 text-xs ${
                        r.author === "admin"
                          ? isDark
                            ? "bg-emerald-950/40 text-emerald-100"
                            : "bg-emerald-50 text-emerald-950"
                          : isDark
                          ? "bg-slate-800 text-slate-200"
                          : "bg-stone-100 text-stone-800"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between text-[11px] font-semibold">
                        <span className="flex items-center gap-1">
                          {r.author === "admin" ? (
                            <>
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Вы (Администратор)</span>
                            </>
                          ) : (
                            <>
                              <User className="h-3.5 w-3.5" />
                              <span>{ticket.name}</span>
                            </>
                          )}
                        </span>
                        <span className="opacity-60">
                          {new Date(r.createdAt).toLocaleTimeString("ru-RU", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="whitespace-pre-line">{r.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Форма ответа администратора */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={replyDrafts[ticket.id] || ""}
                  onChange={(e) =>
                    setReplyDrafts((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleSendReply(ticket.id);
                    }
                  }}
                  placeholder="Написать ответ пользователю..."
                  className={`flex-1 rounded-xl border px-3.5 py-2 text-xs outline-none focus:border-emerald-500 ${
                    isDark
                      ? "border-slate-800 bg-slate-950 text-white placeholder-slate-500"
                      : "border-stone-200 bg-stone-50 text-stone-900 placeholder-stone-400"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => handleSendReply(ticket.id)}
                  disabled={!(replyDrafts[ticket.id] || "").trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Ответить</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
