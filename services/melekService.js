import crypto from "crypto";
import OpenAI from "openai";
import { MELEK_DECK } from "../utils/melekDeck.js";
import { PRICING } from "../utils/pricing.js";
import { decreaseCoin } from "../utils/coinManager.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const sessionStore = new Map();
const SESSION_TTL = 1000 * 60 * 10;

/* =========================
   UTIL
========================= */

function randomFromRange(min, max, exclude = new Set()) {
  const pool = MELEK_DECK.filter(
    (c) => c.id >= min && c.id <= max && !exclude.has(c.id)
  );

  if (!pool.length) throw new Error("Kart bulunamadı");

  return pool[Math.floor(Math.random() * pool.length)];
}

function getCardCount(mode) {
  if (!["standard", "deep", "zaman"].includes(mode)) {
    throw new Error("Geçersiz melek modu");
  }

  if (mode === "standard") return 1;
  if (mode === "deep") return 2;
  return 3;
}

function getMelekPrice(mode) {
  if (mode === "standard") return PRICING.MELEK.ONE_CARD;
  if (mode === "deep") return PRICING.MELEK.TWO_CARD;
  if (mode === "zaman") return PRICING.MELEK.THREE_CARD;
  throw new Error("Fiyat hesaplanamadı");
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

  const used = new Set();
  const cards = [];

  if (mode === "standard") {
    cards.push(randomFromRange(33, 53, used));
  }

  if (mode === "deep") {
    const c1 = randomFromRange(33, 53, used);
    used.add(c1.id);
    const c2 = randomFromRange(0, 32, used);
    cards.push(c1, c2);
  }

  if (mode === "zaman") {
    for (let i = 0; i < 3; i++) {
      const c = randomFromRange(0, 53, used);
      used.add(c.id);
      cards.push(c);
    }
  }

  const sessionId = crypto.randomUUID();

  const interpretationPromise = generateInterpretation(
    mode,
    question,
    cards
  ).catch(() => null);

  sessionStore.set(sessionId, {
    uid,
    mode,
    question: question || null,
    cards,
    revealed: [],
    interpretationPromise,
    createdAt: Date.now(),
  });

  return { sessionId, cardCount };
}

/* =========================
   REVEAL
========================= */

export async function revealMelek(uid, body) {
  const { sessionId } = body;

  const session = sessionStore.get(sessionId);
  if (!session) throw new Error("Session bulunamadı");
  if (session.uid !== uid) throw new Error("Yetkisiz erişim");

  if (isExpired(session)) {
    sessionStore.delete(sessionId);
    throw new Error("Session süresi doldu");
  }

  const nextIndex = session.revealed.length;
  if (nextIndex >= session.cards.length)
    throw new Error("Tüm kartlar açıldı");

  const card = session.cards[nextIndex];
  session.revealed.push(card);

  const picked = session.revealed.map((c) => ({
    title: c.title,
    image: c.image,
  }));

  /* =========================
     SON KART
  ========================= */

  if (session.revealed.length === session.cards.length) {
    const interpretation = await session.interpretationPromise;

    if (!interpretation) {
      throw new Error("Yorum üretilemedi");
    }

    const price = getMelekPrice(session.mode);

    const remainingCoin = await decreaseCoin(
      uid,
      price,
      "MELEK",
      { sessionId }
    );

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

/* =========================
   GPT
========================= */

async function generateInterpretation(mode, question, cards) {
  let formattedCards = "";
  let structureInstruction = "";

  if (mode === "standard") {
    formattedCards = `Kart: ${cards[0].title}`;
    structureInstruction = `
Bu kartın ana mesajını açık ve güçlü şekilde yorumla.
`;
  }

  if (mode === "deep") {
    formattedCards = `
1. Kart: ${cards[0].title}
2. Kart: ${cards[1].title}
`;
    structureInstruction = `
Kartları ayrı ayrı yorumla ve sonunda birleşik mesaj ver.
`;
  }

  if (mode === "zaman") {
    formattedCards = `
Geçmiş: ${cards[0].title}
Şimdi: ${cards[1].title}
Gelecek: ${cards[2].title}
`;
    structureInstruction = `
Zaman akışına göre yorumla. Detaylı ve uzun olsun.
`;
  }

  const prompt = `
Sen Arap Bacı uygulamasında ilahi rehberlik sunan mistik bir melek kartları yorumcususun.

Soru: ${question || "Genel rehberlik"}

${formattedCards}

${structureInstruction}
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
  });

  return completion.choices[0].message.content;
}