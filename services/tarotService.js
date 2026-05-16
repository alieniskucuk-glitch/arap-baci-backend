import crypto from "crypto";
import openai from "../config/openai.js";
import { decreaseCoin } from "../utils/coinManager.js";
import { getTarotById } from "../utils/tarotDeck.js";
import { db, admin } from "../config/firebase.js";

/* =========================
   MEMORY SESSION STORE
========================= */

const sessionStore = new Map();
const SESSION_TTL = 1000 * 60 * 10;

function isExpired(session) {
  return Date.now() - session.createdAt > SESSION_TTL;
}

function sessionRef(uid, sessionId) {
  return db
    .collection("users")
    .doc(uid)
    .collection("history")
    .doc(sessionId);
}

async function existsSessionDoc(uid, sessionId) {
  const snap = await sessionRef(uid, sessionId).get();
  return snap.exists;
}

async function createSessionDoc(uid, sessionId, data) {
  await sessionRef(uid, sessionId).set(data, { merge: false });
}

async function getSessionDoc(uid, sessionId) {
  const snap = await sessionRef(uid, sessionId).get();
  if (!snap.exists) return null;
  return snap.data();
}

async function updateSessionDoc(uid, sessionId, patch) {
  await sessionRef(uid, sessionId).set(patch, { merge: true });
}

async function markCompleted(uid, sessionId, patch = {}) {
  await updateSessionDoc(uid, sessionId, {
    status: "completed",
    completedAt: Date.now(),
    completedAtServer: admin.firestore.FieldValue.serverTimestamp(),
    ...patch,
  });
}

async function markExpired(uid, sessionId) {
  await updateSessionDoc(uid, sessionId, {
    status: "expired",
    expiredAt: Date.now(),
    expiredAtServer: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/* =========================
   MEMORY CLEANUP
========================= */

setInterval(() => {
  const now = Date.now();

  for (const [id, session] of sessionStore.entries()) {
    if (now - session.createdAt > SESSION_TTL) {
      sessionStore.delete(id);
    }
  }
}, 60000);

/* =========================
   HELPERS
========================= */

function resolveCardCount(mode) {
  switch (mode) {
    case "one": return 1;
    case "two": return 2;
    case "three": return 3;
    case "five": return 5;
    case "celtic": return 10;
    default: throw new Error("Geçersiz tarot mode");
  }
}

function pickCards(count) {
  const all = Array.from({ length: 78 }, (_, i) => i);

  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }

  return all.slice(0, count);
}

function resolveSpreadDescription(mode) {
  return {
    one: "Tek kart ilahi mesaj",
    two: "Durum ve karşıt enerji",
    three: "Geçmiş - Şimdi - Gelecek",
    five: "Detaylı rehberlik açılımı",
    celtic: "Kelt Haçı kapsamlı kader analizi",
  }[mode];
}

function toPicked(selectedCards, revealedCount) {
  return (selectedCards || []).slice(0, revealedCount).map((id) => {
    const card = getTarotById(id);

    return {
      id,
      title: card.title || card.name || card.trTitle || null,
      image: card.image,
    };
  });
}

/* =========================
   START
========================= */

export async function startTarot(uid, { mode, subType, question, coinPrice }) {

  if (!uid) throw new Error("UID gerekli");
  if (!coinPrice) throw new Error("Coin price eksik");

  const cardCount = resolveCardCount(mode);
  const selectedCards = pickCards(cardCount);

  const sessionId = crypto.randomUUID();
  const createdAt = Date.now();

  const interpretationPromise = generateInterpretation({
    mode,
    subType,
    question,
    selectedCards,
  })
    .then((text) => (text || "").trim() || null)
    .catch((err) => {
      console.error("GPT ERROR:", err);
      return null;
    });

  sessionStore.set(sessionId, {
    uid,
    mode,
    subType,
    question,
    selectedCards,
    revealed: [],
    interpretationPromise,
    cost: coinPrice,
    createdAt,
    processing: false,
    status: "active",
  });

  return { sessionId, cardCount };
}

/* =========================
   REVEAL
========================= */

export async function revealTarot(uid, { sessionId }) {

  let session = sessionStore.get(sessionId);

  if (!session) {
    const doc = await getSessionDoc(uid, sessionId);
    if (!doc) throw new Error("Session yok");

    session = {
      uid: doc.uid,
      mode: doc.mode,
      subType: doc.subType || null,
      question: doc.question || null,
      selectedCards: doc.selectedCards || [],
      revealed: doc.revealed || [],
      interpretationPromise: null,
      cost: doc.cost,
      createdAt: doc.createdAt,
      processing: !!doc.processing,
      status: doc.status || "active",
    };

    sessionStore.set(sessionId, session);
  }

  if (session.uid !== uid) throw new Error("Yetkisiz");

  if (isExpired(session)) {
    await markExpired(uid, sessionId);
    sessionStore.delete(sessionId);
    throw new Error("Session süresi doldu");
  }

  const nextIndex = session.revealed.length;
  const cardId = session.selectedCards[nextIndex];

  session.revealed.push(cardId);

  const picked = toPicked(
    session.selectedCards,
    session.revealed.length
  );

  if (session.revealed.length === session.selectedCards.length) {

    let interpretation =
      await session.interpretationPromise;

    const remainingCoin = await decreaseCoin(
      uid,
      session.cost,
      "TAROT",
      { sessionId, mode: session.mode }
    );

    if (!(await existsSessionDoc(uid, sessionId))) {

      await createSessionDoc(uid, sessionId, {
        uid,
        type: "tarot",
        sessionId,
        mode: session.mode,
        subType: session.subType,
        question: session.question,
        selectedCards: session.selectedCards,
        revealed: session.revealed,
        cards: picked,
        cost: session.cost,
        createdAt: session.createdAt,
        createdAtServer:
          admin.firestore.FieldValue.serverTimestamp(),
        status: "active",
        interpretation,
        processing: false,
      });

    }

    await markCompleted(uid, sessionId, {
      remainingCoin,
      cards: picked,
      interpretation,
    });

    sessionStore.delete(sessionId);

    return {
      picked,
      interpretation,
      remainingCoin,
    };
  }

  return {
    picked,
    interpretation: null,
    remainingCoin: null,
  };
}