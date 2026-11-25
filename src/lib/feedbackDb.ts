"use client";

export type FeedbackCategory = "question" | "bug" | "suggestion";
export type FeedbackStatus = "open" | "answered" | "closed";

export interface FeedbackReply {
  id: string;
  author: "user" | "admin";
  text: string;
  createdAt: string;
}

export interface FeedbackTicket {
  id: string;
  clientId: string;
  name: string;
  contact: string;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
  replies: FeedbackReply[];
  unreadByUser?: boolean;
  unreadByAdmin?: boolean;
}

const LS_TICKETS_KEY = "musafir:feedback-tickets-v1";
const LS_CLIENT_ID_KEY = "musafir:feedback-client-id";
const LS_ADMIN_PIN_KEY = "musafir:admin-pin";
const LS_CUSTOM_CLOUD_URL = "musafir:feedback-cloud-url";

const IDB_NAME = "musafir_feedback_db";
const IDB_STORE = "tickets";
const IDB_VERSION = 1;

// Облачный канал синхронизации (работает по HTTPS с CORS без регистрации + поддерживает кастомный REST URL)
const DEFAULT_CLOUD_TOPIC = "https://ntfy.sh/musafir_pwa_feedback_channel_9a1f5b6";

type CloudEventPayload =
  | { type: "UPSERT_TICKET"; ticket: FeedbackTicket }
  | { type: "DELETE_TICKET"; ticketId: string };

/** Возвращает уникальный ID текущего устройства пользователя */
export function getClientId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem(LS_CLIENT_ID_KEY);
  if (!id) {
    id = "u_" + Math.random().toString(36).slice(2, 10) + "_" + Date.now().toString(36);
    localStorage.setItem(LS_CLIENT_ID_KEY, id);
  }
  return id;
}

/** Проверка и смена PIN-кода администратора (по умолчанию 0707) */
export function getAdminPin(): string {
  if (typeof window === "undefined") return "0707";
  return localStorage.getItem(LS_ADMIN_PIN_KEY) || "0707";
}

export function setAdminPin(newPin: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_ADMIN_PIN_KEY, newPin.trim() || "0707");
}

export function getCustomCloudUrl(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(LS_CUSTOM_CLOUD_URL) || process.env.NEXT_PUBLIC_FEEDBACK_DB_URL || "";
}

export function setCustomCloudUrl(url: string): void {
  if (typeof window === "undefined") return;
  const clean = url.trim();
  if (clean) {
    localStorage.setItem(LS_CUSTOM_CLOUD_URL, clean);
  } else {
    localStorage.removeItem(LS_CUSTOM_CLOUD_URL);
  }
}

/** Открытие локальной базы данных IndexedDB */
function openIdb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveToIdb(tickets: FeedbackTicket[]): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      store.clear();
      for (const t of tickets) {
        store.put(t);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function readFromIdb(): Promise<FeedbackTicket[] | null> {
  const db = await openIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function notifySubscribers() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("musafir-feedback-updated"));
  if ("BroadcastChannel" in window) {
    try {
      const bc = new BroadcastChannel("musafir-feedback");
      bc.postMessage({ updatedAt: Date.now() });
      bc.close();
    } catch {
      /* ignore */
    }
  }
}

/** Чтение обращений из локального зеркала */
export function getLocalTickets(): FeedbackTicket[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_TICKETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort(
      (a: FeedbackTicket, b: FeedbackTicket) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch {
    return [];
  }
}

function saveLocalTickets(tickets: FeedbackTicket[]) {
  if (typeof window === "undefined") return;
  const sorted = [...tickets].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  localStorage.setItem(LS_TICKETS_KEY, JSON.stringify(sorted));
  void saveToIdb(sorted);
  notifySubscribers();
}

/** Слияние локальных и облачных тикетов по наиболее свежему updatedAt */
function mergeTicketLists(
  localList: FeedbackTicket[],
  remoteList: FeedbackTicket[],
  deletedIds: Set<string> = new Set()
): FeedbackTicket[] {
  const map = new Map<string, FeedbackTicket>();
  for (const t of localList) {
    if (!deletedIds.has(t.id)) {
      map.set(t.id, t);
    }
  }
  for (const r of remoteList) {
    if (!r || !r.id || deletedIds.has(r.id)) continue;
    const existing = map.get(r.id);
    if (!existing) {
      map.set(r.id, r);
    } else {
      const remoteTime = new Date(r.updatedAt).getTime();
      const localTime = new Date(existing.updatedAt).getTime();
      if (remoteTime >= localTime || (r.replies?.length ?? 0) > (existing.replies?.length ?? 0)) {
        map.set(r.id, r);
      }
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/** Отправка события в облачную БД */
async function pushCloudEvent(payload: CloudEventPayload): Promise<void> {
  if (typeof window === "undefined") return;
  const customUrl = getCustomCloudUrl();

  try {
    if (customUrl) {
      await fetch(customUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return;
    }

    await fetch(DEFAULT_CLOUD_TOPIC, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch {
    /* Оффлайн-режим: данные уже сохранены в IndexedDB и localStorage */
  }
}

/** Синхронизация с IndexedDB и облачной базой данных */
export async function syncFeedbackDatabase(): Promise<FeedbackTicket[]> {
  if (typeof window === "undefined") return [];

  let current = getLocalTickets();
  const idbList = await readFromIdb();
  if (idbList && idbList.length > 0) {
    current = mergeTicketLists(current, idbList);
  }

  const customUrl = getCustomCloudUrl();

  try {
    if (customUrl) {
      const res = await fetch(customUrl, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const remoteTickets = Array.isArray(data)
          ? data
          : Array.isArray(data?.tickets)
          ? data.tickets
          : [];
        current = mergeTicketLists(current, remoteTickets);
        saveLocalTickets(current);
        return current;
      }
    } else {
      const res = await fetch(`${DEFAULT_CLOUD_TOPIC}/json?poll=1&since=all`, {
        cache: "no-store",
      });
      if (res.ok) {
        const text = await res.text();
        const lines = text.split("\n").filter(Boolean);
        const remoteTickets: FeedbackTicket[] = [];
        const deletedIds = new Set<string>();

        for (const line of lines) {
          try {
            const env = JSON.parse(line);
            if (env?.event === "message" && typeof env.message === "string") {
              const payload = JSON.parse(env.message) as CloudEventPayload;
              if (payload.type === "UPSERT_TICKET" && payload.ticket?.id) {
                deletedIds.delete(payload.ticket.id);
                remoteTickets.push(payload.ticket);
              } else if (payload.type === "DELETE_TICKET" && payload.ticketId) {
                deletedIds.add(payload.ticketId);
              }
            }
          } catch {
            /* skip non-json line */
          }
        }

        current = mergeTicketLists(current, remoteTickets, deletedIds);
        saveLocalTickets(current);
        return current;
      }
    }
  } catch {
    /* Оффлайн: возвращаем локальную БД */
  }

  saveLocalTickets(current);
  return current;
}

/** Создание нового обращения пользователем */
export async function createFeedbackTicket(input: {
  name?: string;
  contact?: string;
  category: FeedbackCategory;
  message: string;
}): Promise<FeedbackTicket> {
  const now = new Date().toISOString();
  const ticket: FeedbackTicket = {
    id: "t_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7),
    clientId: getClientId(),
    name: input.name?.trim() || "Путник",
    contact: input.contact?.trim() || "",
    category: input.category,
    message: input.message.trim(),
    status: "open",
    createdAt: now,
    updatedAt: now,
    replies: [],
    unreadByUser: false,
    unreadByAdmin: true,
  };

  const current = getLocalTickets();
  saveLocalTickets([ticket, ...current]);
  await pushCloudEvent({ type: "UPSERT_TICKET", ticket });
  return ticket;
}

/** Добавление ответа (от администратора или от пользователя) */
export async function addTicketReply(params: {
  ticketId: string;
  author: "user" | "admin";
  text: string;
}): Promise<FeedbackTicket | null> {
  const current = getLocalTickets();
  const idx = current.findIndex((t) => t.id === params.ticketId);
  if (idx === -1) return null;

  const now = new Date().toISOString();
  const reply: FeedbackReply = {
    id: "r_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6),
    author: params.author,
    text: params.text.trim(),
    createdAt: now,
  };

  const existing = current[idx];
  const updated: FeedbackTicket = {
    ...existing,
    status: params.author === "admin" ? "answered" : "open",
    updatedAt: now,
    replies: [...(existing.replies || []), reply],
    unreadByUser: params.author === "admin" ? true : existing.unreadByUser,
    unreadByAdmin: params.author === "user" ? true : false,
  };

  const next = [...current];
  next[idx] = updated;
  saveLocalTickets(next);
  await pushCloudEvent({ type: "UPSERT_TICKET", ticket: updated });
  return updated;
}

/** Изменение статуса обращения (open / answered / closed) */
export async function updateTicketStatus(
  ticketId: string,
  status: FeedbackStatus
): Promise<FeedbackTicket | null> {
  const current = getLocalTickets();
  const idx = current.findIndex((t) => t.id === ticketId);
  if (idx === -1) return null;

  const updated: FeedbackTicket = {
    ...current[idx],
    status,
    updatedAt: new Date().toISOString(),
    unreadByAdmin: false,
  };

  const next = [...current];
  next[idx] = updated;
  saveLocalTickets(next);
  await pushCloudEvent({ type: "UPSERT_TICKET", ticket: updated });
  return updated;
}

/** Сброс флага непрочитанного ответа у пользователя */
export function markUserTicketsRead(): void {
  const clientId = getClientId();
  const current = getLocalTickets();
  let changed = false;
  const next = current.map((t) => {
    if (t.clientId === clientId && t.unreadByUser) {
      changed = true;
      return { ...t, unreadByUser: false };
    }
    return t;
  });
  if (changed) {
    saveLocalTickets(next);
  }
}

/** Удаление обращения администратором */
export async function deleteTicket(ticketId: string): Promise<void> {
  const current = getLocalTickets();
  saveLocalTickets(current.filter((t) => t.id !== ticketId));
  await pushCloudEvent({ type: "DELETE_TICKET", ticketId });
}

/** Подписка на обновления БД (локально и между вкладками) */
export function subscribeFeedbackUpdates(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = () => callback();
  window.addEventListener("musafir-feedback-updated", handler);
  window.addEventListener("storage", handler);

  let bc: BroadcastChannel | null = null;
  if ("BroadcastChannel" in window) {
    try {
      bc = new BroadcastChannel("musafir-feedback");
      bc.onmessage = handler;
    } catch {
      /* ignore */
    }
  }

  return () => {
    window.removeEventListener("musafir-feedback-updated", handler);
    window.removeEventListener("storage", handler);
    bc?.close();
  };
}
