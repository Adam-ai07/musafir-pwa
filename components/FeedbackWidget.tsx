"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckCircle2,
  Loader2,
  Lock,
  MessageSquarePlus,
  Send,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import {
  addTicketReply,
  createFeedbackTicket,
  getClientId,
  getLocalTickets,
  markUserTicketsRead,
  subscribeFeedbackUpdates,
  syncFeedbackDatabase,
  type FeedbackCategory,
  type FeedbackTicket,
} from "@/src/lib/feedbackDb";
import { useSettings } from "@/src/context/SettingsContext";

const CATEGORIES: { id: FeedbackCategory; label: string }[] = [
  { id: "question", label: "Вопрос" },
  { id: "suggestion", label: "Предложение" },
  { id: "bug", label: "Ошибка" },
];

export default function FeedbackWidget() {
  const pathname = usePathname();
  const { settings } = useSettings();
  const isDark = settings.theme === "dark";

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"form" | "my">("form");
  const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
  const [clientId, setClientId] = useState<string>("");

  // Поля формы
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("suggestion");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  // Дополнение к существующему обращению
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});

  const refresh = useCallback(() => {
    setTickets(getLocalTickets());
  }, []);

  useEffect(() => {
    setClientId(getClientId());
    refresh();
    void syncFeedbackDatabase();
    return subscribeFeedbackUpdates(refresh);
  }, [refresh]);

  const myTickets = useMemo(
    () => tickets.filter((t) => t.clientId === clientId),
    [tickets, clientId]
  );

  const unreadRepliesCount = useMemo(
    () => myTickets.filter((t) => t.unreadByUser).length,
    [myTickets]
  );

  useEffect(() => {
    if (open && activeTab === "my" && unreadRepliesCount > 0) {
      markUserTicketsRead();
    }
  }, [open, activeTab, unreadRepliesCount]);

  // Не дублируем виджет на самой странице админ-панели
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  const handleOpen = () => {
    setOpen(true);
    void syncFeedbackDatabase();
    if (unreadRepliesCount > 0) {
      setActiveTab("my");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || submitting) return;

    setSubmitting(true);
    try {
      await createFeedbackTicket({
        name,
        contact,
        category,
        message,
      });
      setMessage("");
      setSentSuccess(true);
      setTimeout(() => {
        setSentSuccess(false);
        setActiveTab("my");
      }, 1200);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUserReply = async (ticketId: string) => {
    const text = (replyTexts[ticketId] || "").trim();
    if (!text) return;
    setReplyTexts((prev) => ({ ...prev, [ticketId]: "" }));
    await addTicketReply({ ticketId, author: "user", text });
  };

  return (
    <>
      {/* Плавающая кнопка обратной связи в правом нижнем углу */}
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Обратная связь"
        className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-950/50 ring-2 ring-emerald-400/30 transition-all duration-200 ease-in-out hover:bg-emerald-400 active:scale-90"
      >
        <MessageSquarePlus className="h-6 w-6" />
        {unreadRepliesCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[11px] font-bold text-slate-950 shadow">
            {unreadRepliesCount}
          </span>
        )}
      </button>

      {/* Модальное окно виджета (над нижней панелью навигации, со скроллом на мобильных) */}
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 px-3 pt-4 pb-[calc(5.25rem+env(safe-area-inset-bottom))] backdrop-blur-xs sm:items-center sm:p-4 animate-[fadeIn_0.2s_ease-out]"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`flex max-h-[calc(100dvh-6.5rem-env(safe-area-inset-bottom))] w-full max-w-md flex-col overflow-hidden rounded-3xl border shadow-2xl transition-all ${
              isDark
                ? "border-slate-800 bg-slate-900 text-slate-100"
                : "border-stone-200 bg-white text-stone-900"
            }`}
          >
            {/* Шапка модального окна */}
            <div
              className={`flex items-center justify-between border-b px-5 py-3.5 ${
                isDark ? "border-slate-800" : "border-stone-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <MessageSquarePlus className="h-5 w-5 text-emerald-500" />
                <h2 className="text-base font-bold">Обратная связь</h2>
              </div>

              <div className="flex items-center gap-1.5">
                <Link
                  href="/admin"
                  prefetch={false}
                  onClick={() => setOpen(false)}
                  title="Вход для владельца"
                  className={`rounded-xl p-2 text-xs transition ${
                    isDark
                      ? "text-slate-500 hover:bg-slate-800 hover:text-emerald-400"
                      : "text-stone-400 hover:bg-stone-100 hover:text-emerald-600"
                  }`}
                >
                  <Lock className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Закрыть"
                  className={`rounded-xl p-1.5 transition ${
                    isDark
                      ? "text-slate-400 hover:bg-slate-800 hover:text-white"
                      : "text-stone-500 hover:bg-stone-100 hover:text-stone-900"
                  }`}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Переключатель: Новое сообщение / Мои обращения */}
            <div className="px-5 pt-3">
              <div
                className={`grid grid-cols-2 gap-1 rounded-2xl p-1 ${
                  isDark ? "bg-slate-950/70" : "bg-stone-100"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab("form")}
                  className={`rounded-xl py-2 text-xs font-semibold transition ${
                    activeTab === "form"
                      ? "bg-emerald-500 text-slate-950 shadow-xs"
                      : isDark
                      ? "text-slate-400 hover:text-slate-200"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  Написать
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("my")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition ${
                    activeTab === "my"
                      ? "bg-emerald-500 text-slate-950 shadow-xs"
                      : isDark
                      ? "text-slate-400 hover:text-slate-200"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  <span>Мои обращения</span>
                  {myTickets.length > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] tabular-nums ${
                        activeTab === "my"
                          ? "bg-slate-950/20 text-slate-950"
                          : "bg-emerald-500/20 text-emerald-500"
                      }`}
                    >
                      {myTickets.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Тело виджета со скроллом на мобильных устройствах */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-6">
              {activeTab === "form" ? (
                sentSuccess ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center animate-[fadeIn_0.2s_ease-out]">
                    <CheckCircle2 className="mb-3 h-12 w-12 text-emerald-500" />
                    <p className="text-base font-bold">Сообщение отправлено!</p>
                    <p className={`mt-1 text-xs ${isDark ? "text-slate-400" : "text-stone-500"}`}>
                      Ответ администратора появится во вкладке «Мои обращения».
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-3.5">
                    <div className="grid grid-cols-3 gap-1.5">
                      {CATEGORIES.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCategory(c.id)}
                          className={`rounded-xl border py-2 text-xs font-medium transition ${
                            category === c.id
                              ? "border-emerald-500 bg-emerald-500/15 text-emerald-400"
                              : isDark
                              ? "border-slate-800 bg-slate-950/50 text-slate-400"
                              : "border-stone-200 bg-stone-50 text-stone-600"
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ваше имя (необязательно)"
                        className={`w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none focus:border-emerald-500 ${
                          isDark
                            ? "border-slate-800 bg-slate-950/70 text-white placeholder-slate-500"
                            : "border-stone-200 bg-stone-50 text-stone-900 placeholder-stone-400"
                        }`}
                      />
                      <input
                        type="text"
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        placeholder="Telegram / телефон для связи"
                        className={`w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none focus:border-emerald-500 ${
                          isDark
                            ? "border-slate-800 bg-slate-950/70 text-white placeholder-slate-500"
                            : "border-stone-200 bg-stone-50 text-stone-900 placeholder-stone-400"
                        }`}
                      />
                    </div>

                    <textarea
                      required
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Напишите ваш вопрос, пожелание или сообщите об ошибке..."
                      className={`w-full resize-none rounded-2xl border p-3.5 text-sm outline-none focus:border-emerald-500 ${
                        isDark
                          ? "border-slate-800 bg-slate-950/70 text-white placeholder-slate-500"
                          : "border-stone-200 bg-stone-50 text-stone-900 placeholder-stone-400"
                      }`}
                    />

                    <button
                      type="submit"
                      disabled={submitting || !message.trim()}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-slate-950 shadow-md shadow-emerald-500/20 transition hover:bg-emerald-400 active:scale-[0.99] disabled:opacity-50"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      <span>Отправить сообщение</span>
                    </button>
                  </form>
                )
              ) : myTickets.length === 0 ? (
                <div className="py-10 text-center">
                  <p className={`text-sm ${isDark ? "text-slate-400" : "text-stone-500"}`}>
                    У вас пока нет отправленных обращений.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myTickets.map((t) => (
                    <div
                      key={t.id}
                      className={`rounded-2xl border p-3.5 space-y-2.5 ${
                        isDark
                          ? "border-slate-800 bg-slate-950/60"
                          : "border-stone-200 bg-stone-50/80"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-semibold text-emerald-500">
                          {CATEGORIES.find((c) => c.id === t.category)?.label ?? "Обращение"}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-medium ${
                            t.status === "answered"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : t.status === "closed"
                              ? "bg-slate-700/40 text-slate-400"
                              : "bg-amber-500/15 text-amber-400"
                          }`}
                        >
                          {t.status === "answered"
                            ? "Получен ответ"
                            : t.status === "closed"
                            ? "Закрыто"
                            : "Ожидает ответа"}
                        </span>
                      </div>

                      <p className="text-sm whitespace-pre-line">{t.message}</p>

                      {/* Ответы */}
                      {t.replies && t.replies.length > 0 && (
                        <div className="space-y-2 pt-1">
                          {t.replies.map((r) => (
                            <div
                              key={r.id}
                              className={`rounded-xl p-2.5 text-xs ${
                                r.author === "admin"
                                  ? isDark
                                    ? "border border-emerald-500/30 bg-emerald-950/40 text-emerald-100"
                                    : "border border-emerald-500/30 bg-emerald-50 text-emerald-950"
                                  : isDark
                                  ? "bg-slate-900 text-slate-300"
                                  : "bg-white text-stone-700"
                              }`}
                            >
                              <div className="mb-1 flex items-center gap-1 font-semibold">
                                {r.author === "admin" ? (
                                  <>
                                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                                    <span className="text-emerald-400">Ответ администратора</span>
                                  </>
                                ) : (
                                  <>
                                    <User className="h-3.5 w-3.5" />
                                    <span>Вы</span>
                                  </>
                                )}
                              </div>
                              <p className="whitespace-pre-line leading-relaxed">{r.text}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {t.status !== "closed" && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            type="text"
                            value={replyTexts[t.id] || ""}
                            onChange={(e) =>
                              setReplyTexts((prev) => ({ ...prev, [t.id]: e.target.value }))
                            }
                            placeholder="Дополнить обращение..."
                            className={`flex-1 rounded-xl border px-3 py-1.5 text-xs outline-none focus:border-emerald-500 ${
                              isDark
                                ? "border-slate-800 bg-slate-900 text-white placeholder-slate-500"
                                : "border-stone-200 bg-white text-stone-900 placeholder-stone-400"
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => handleUserReply(t.id)}
                            className="rounded-xl bg-emerald-500 p-2 text-slate-950 hover:bg-emerald-400"
                            aria-label="Отправить"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
