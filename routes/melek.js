import crypto from "crypto";
import { MELEK_DECK } from "../utils/melekDeck.js";

const sessionStore = new Map();
const SESSION_TTL = 1000 * 60 * 10; // 10 dakika

/* =========================
   UTIL
========================= */

function randomFromRange(min, max, exclude = new Set()) {
  const pool = MELEK_DECK.filter(
    (c) => c.id >= min && c.id <= max && !exclude.has(c.id)
  );

  if (!pool.length) {
    throw new Error("Kart bulunamadı");
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

function buildCardsByMode(mode) {
  const used = new Set();
  const cards = [];

  if (mode === "standard") {
    const c = randomFromRange(34, 54, used);
    cards.push(c);
  }

  if (mode === "deep") {
    const c1 = randomFromRange(34, 54, used);
    used.add(c1.id);

    const c2 = randomFromRange(1, 33, used);
    cards.push(c1, c2);
  }

  if (mode === "zaman") {
    for (let i = 0; i < 3; i++) {
      const c = randomFromRange(1, 54, used);
      used.add(c.id);
      cards.push(c);
    }
  }

  return cards;
}

function getCardCount(mode) {
  if (!["standard", "deep", "zaman"].includes(mode)) {
    throw new Error("Geçersiz melek modu");
  }

  if (mode === "standard") return 1;
  if (mode === "deep") return 2;
  return 3;
}

function isExpired(session) {
  return Date.now() - session.createdAt > SESSION_TTL;
}

/* =========================
   START
========================= */

export async function startMelek(uid, body) {
  const { mode, question } = body;

  const cardCount = getCardCount(mode);
  const cards = buildCardsByMode(mode);

  const sessionId = crypto.randomUUID();

  sessionStore.set(sessionId, {
    uid,
    mode,
    question: question || null,
    cards,
    revealed: [],
    createdAt: Date.now(),
  });

  return {
    sessionId,
    cardCount,
  };
}

/* =========================
   SESSION MANAGEMENT
========================= */

export function getMelekSession(sessionId) {
  const session = sessionStore.get(sessionId);
  if (!session) return null;

  if (isExpired(session)) {
    sessionStore.delete(sessionId);
    return null;
  }

  return session;
}

export function deleteMelekSession(sessionId) {
  sessionStore.delete(sessionId);
}
