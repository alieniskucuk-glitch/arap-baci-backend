import crypto from "crypto";
import OpenAI from "openai";
import { db } from "../config/firebase.js";
import { MELEK_DECK } from "../utils/melekDeck.js";
import { PRICING } from "../utils/pricing.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const sessionStore = new Map();
const SESSION_TTL = 1000 * 60 * 10; // 10 dakika

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

  const sessionId = crypto.randomUUID();

  sessionStore.set(sessionId, {
    uid,
    mode,
    question: question || null,
    cards,
    revealed: [],
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

  if (session.uid !== uid)
    throw new Error("Yetkisiz erişim");

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
     FINAL STEP
  ========================= */

  if (session.revealed.length === session.cards.length) {

    let interpretation;

    try {
      interpretation = await generateInterpretation(
        session.mode,
        session.question,
        session.cards
      );
    } catch (err) {
      sessionStore.delete(sessionId);
      throw new Error("Yorum üretilemedi");
    }

    const price = getMelekPrice(session.mode);
    const userRef = db.collection("users").doc(uid);

    let remainingCoin = 0;

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists)
        throw new Error("Kullanıcı bulunamadı");

      const user = snap.data();

      let dailyCoin = Number(user.dailyCoin ?? 0);
      let abCoin = Number(user.abCoin ?? 0);

      let remaining = price;

      if (dailyCoin >= remaining) {
        dailyCoin -= remaining;
        remaining = 0;
      } else {
        remaining -= dailyCoin;
        dailyCoin = 0;
      }

      if (remaining > 0) {
        if (abCoin < remaining)
          throw new Error("Yetersiz coin");
        abCoin -= remaining;
      }

      remainingCoin = dailyCoin + abCoin;

      tx.update(userRef, { dailyCoin, abCoin });
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

/* =========================
   GPT – MODE AKILLI
========================= */

async function generateInterpretation(mode, question, cards) {

  let formattedCards = "";
  let structureInstruction = "";

  if (mode === "standard") {
    formattedCards = `
Kart: ${cards[0].title}
`;
    structureInstruction = `
Bu kartın ana mesajını açık ve güçlü şekilde yorumla.
Kartın enerjisini net biçimde açıkla.
Sonunda kısa bir yönlendirme cümlesi yaz.
`;
  }

  if (mode === "deep") {
    formattedCards = `
1. Kart (Mevcut Enerji): ${cards[0].title}
2. Kart (İlahi Rehberlik): ${cards[1].title}
`;
    structureInstruction = `
Önce 1. kartı detaylı yorumla. net cevap seklinde olsun.
Sonra 2. kartı çözüm ve rehberlik olarak açıkla.
En sonda iki kartın birleşik mesajını yaz.
`;
  }

  if (mode === "zaman") {
    formattedCards = `
1. Kart (Geçmiş Enerjisi): ${cards[0].title}
2. Kart (Şu Anki Enerji): ${cards[1].title}
3. Kart (Gelecek Enerjisi): ${cards[2].title}
`;
    structureInstruction = `
Her kartı kendi zaman dilimine göre ayrı ayrı yorumla.
Geçmişin bugüne etkisini açıkla.
Geleceğin nasıl şekillenebileceğini belirt.
En sonda genel bir kapanış paragrafı yaz.
`;
  }

  const prompt = `
Sen Arap Bacı uygulamasında ilahi rehberlik sunan mistik bir melek kartları yorumcususun.

Soru: ${question || "Genel rehberlik"}

Açılan Kartlar:
${formattedCards}

${structureInstruction}

Spiritüel ama net ol.
Abartılı dramatik olma.
Gerçekçi ama umut verici ol.
Paragrafları düzenli yaz.
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return completion.choices[0].message.content;
}
