import crypto from "crypto";
import { MELEK_DECK } from "../utils/melekDeck.js";

const sessionStore = new Map();

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
    const c1 = randomFromRange(34, 54, used);
    used.add(c1.id);
    cards.push(c1);
  }

  if (mode === "deep") {
    const c1 = randomFromRange(34, 54, used);
    used.add(c1.id);

    const c2 = randomFromRange(1, 33, used);
    used.add(c2.id);

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
  if (mode === "standard") return 1;
  if (mode === "deep") return 2;
  if (mode === "zaman") return 3;
  throw new Error("Geçersiz melek modu");
}

/* =========================
   START
========================= */

export async function startMelek(uid, body) {
  const { mode, question } = body;

  if (!["standard", "deep", "zaman"].includes(mode)) {
    throw new Error("Geçersiz melek modu");
  }

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
   SESSION HELPERS
========================= */

export function getMelekSession(sessionId) {
  return sessionStore.get(sessionId);
}

export function deleteMelekSession(sessionId) {
  sessionStore.delete(sessionId);
}
