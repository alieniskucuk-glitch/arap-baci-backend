import crypto from "crypto";
import openai from "../config/openai.js";
import { decreaseCoin } from "../utils/coinManager.js";
import { getTarotById } from "../utils/tarotDeck.js";
import { db } from "../config/firebase.js";

/* =========================
   MEMORY SESSION STORE
========================= */

const sessionStore = new Map();
const SESSION_TTL = 1000 * 60 * 10;

function isExpired(session) {
  return Date.now() - session.createdAt > SESSION_TTL;
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
  return selectedCards.slice(0, revealedCount).map((id) => {
    const card = getTarotById(id);
    return { id, image: card.image };
  });
}

/* =========================
   PROMPT
========================= */

function buildPrompt({ mode, subType, question, selectedCards }) {

  const spreadDescription = resolveSpreadDescription(mode) || "Tarot açılımı";

  if (mode === "celtic") {

return `
Sen 30 yıllık deneyime sahip, kader analizi yapan güçlü bir tarot ustasısın.

Bu bir Kelt Haçı açılımıdır ve derin kader çözümlemesi gerektirir.

Kart ID’leri: ${(selectedCards || []).join(", ")}
Alt kategori: ${subType || "Genel"}
Kullanıcının Sorusu: ${question || "Belirtilmedi"}

ZORUNLU KURALLAR:
- Minimum 1500 kelime yaz.
- En az 10 paragraf oluştur.
- Her kartı temsil ettiği pozisyona göre ayrı ayrı analiz et.
- Bilinçaltı etkileri açıkla.
- Karmik bağları değerlendir.
- İçsel çatışmaları analiz et.
- Dışsal faktörleri analiz et.
- Kader planı ve ruhsal dersleri detaylandır.
- Kartlar arası enerji akışını mutlaka açıkla.
- Maddi, duygusal, ruhsal ve zihinsel alanları ayrı ayrı ele al.
- Geleceğe dair güçlü ama gerçekçi öngörüler yap.
- Sonunda güçlü bir uyanış ve rehberlik mesajı yaz.

Analiz sürecini anlatma.
Teknik açıklama yapma.
Listeleme yapma.
Yorum doğrudan başlasın.
`.trim();

  }

return `
Sen deneyimli ve sezgisel bir tarot rehberisin.

Açılım Türü: ${spreadDescription}
Kart ID’leri: ${(selectedCards || []).join(", ")}
Alt kategori: ${subType || "Genel"}
Kullanıcının Sorusu: ${question || "Belirtilmedi"}

- Her kart için ayrı paragraf yaz.
- Minimum 750 kelime olsun.
- Kartları tek tek analiz et.
- Kartlar arası enerji bağlantısını açıkla.
- Ruhsal ve psikolojik boyutu değerlendir.
- Somut rehberlik ver.
- Sonunda motive edici bir kapanış yap.

Kısa cevap verme.
Analiz sürecini anlatma.
Yorum doğrudan başlasın.
`.trim();

}

/* =========================
   GPT
========================= */

async function generateInterpretation(data) {

  const prompt = buildPrompt(data);

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.85,
    messages: [
      { role: "system", content: "Sen güçlü ve sezgisel bir tarot ustasısın." },
      { role: "user", content: prompt }
    ]
  });

  return (completion?.choices?.[0]?.message?.content || "").trim();

}

/* =========================
   START
========================= */

export async function startTarot(uid, { mode, subType, question, coinPrice }) {

  const cardCount = resolveCardCount(mode);
  const selectedCards = pickCards(cardCount);

  const sessionId = crypto.randomUUID();

  const session = {
    uid,
    mode,
    subType,
    question,
    selectedCards,
    revealed: [],
    cost: coinPrice,
    createdAt: Date.now(),
    interpretation: null,
    processing: false
  };

  session.interpretationPromise =
    generateInterpretation({
      mode,
      subType,
      question,
      selectedCards
    })
    .then((t) => {
      const s = sessionStore.get(sessionId);
      if (s) s.interpretation = t;
      return t;
    })
    .catch(() => null);

  sessionStore.set(sessionId, session);

  return {
    sessionId,
    cardCount
  };

}

/* =========================
   REVEAL
========================= */

export async function revealTarot(uid, { sessionId }) {

  const session = sessionStore.get(sessionId);

  if (!session) throw new Error("Session yok");

  if (session.uid !== uid)
    throw new Error("Yetkisiz");

  if (isExpired(session)) {
    sessionStore.delete(sessionId);
    throw new Error("Session süresi doldu");
  }

  const nextIndex = session.revealed.length;

  const cardId = session.selectedCards[nextIndex];
  session.revealed.push(cardId);

  const picked = toPicked(session.selectedCards, session.revealed.length);

  /* SON KART */

  if (session.revealed.length === session.selectedCards.length) {

    let interpretation =
      session.interpretation ||
      await session.interpretationPromise;

    if (!interpretation) {
      interpretation = await generateInterpretation({
        mode: session.mode,
        subType: session.subType,
        question: session.question,
        selectedCards: session.selectedCards
      });
    }

    /* COIN DÜŞ */

    const remainingCoin =
      await decreaseCoin(
        uid,
        session.cost,
        "TAROT",
        { sessionId }
      );

    /* HISTORY SAVE */

    try {

      await db
        .collection("users")
        .doc(uid)
        .collection("history")
        .add({
          type: "tarot",
          mode: session.mode,
          subType: session.subType || null,
          question: session.question || null,
          cards: session.selectedCards,
          interpretation,
          createdAt: Date.now()
        });

    } catch (e) {
      console.error("History save error:", e);
    }

    sessionStore.delete(sessionId);

    return {
      picked,
      interpretation,
      remainingCoin
    };

  }

  return {
    picked,
    interpretation: null,
    remainingCoin: null
  };

}