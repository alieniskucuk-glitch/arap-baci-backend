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

/* =========================
   SESSION HELPERS
========================= */

function isExpired(session) {
  return Date.now() - session.createdAt > SESSION_TTL;
}

/* =========================
   HISTORY REF
========================= */

function historyRef(uid, sessionId) {
  return db
    .collection("users")
    .doc(uid)
    .collection("history")
    .doc(sessionId);
}

/* =========================
   HISTORY CREATE
========================= */

async function createHistoryDoc(uid, sessionId, data) {
  await historyRef(uid, sessionId).set(data, { merge: false });
}

/* =========================
   HISTORY EXISTS
========================= */

async function existsHistoryDoc(uid, sessionId) {
  const snap = await historyRef(uid, sessionId).get();
  return snap.exists;
}

/* =========================
   DATE HELPERS
========================= */

function getIstanbulDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getIstanbulDateTimeText() {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
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
   MODE HELPERS
========================= */

function resolveCardCount(mode) {
  switch (mode) {
    case "one":
      return 1;

    case "two":
      return 2;

    case "three":
      return 3;

    case "five":
      return 5;

    case "celtic":
      return 10;

    default:
      throw new Error("Geçersiz tarot mode");
  }
}

/* =========================
   PICK CARDS
========================= */

function pickCards(count) {
  const all = Array.from({ length: 78 }, (_, i) => i);

  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }

  return all.slice(0, count);
}

/* =========================
   SPREAD DESCRIPTION
========================= */

function resolveSpreadDescription(mode) {
  return {
    one: "Tek kart ilahi mesaj",
    two: "Durum ve karşıt enerji",
    three: "Geçmiş - Şimdi - Gelecek",
    five: "Detaylı rehberlik açılımı",
    celtic: "Kelt Haçı kapsamlı kader analizi",
  }[mode];
}

/* =========================
   TAROT TYPE
========================= */

function resolveTarotType(mode, subType) {
  const spread = resolveSpreadDescription(mode) || "Tarot açılımı";

  if (subType) {
    return `${spread} - ${subType}`;
  }

  return spread;
}

/* =========================
   CARD IMAGE HELPER
========================= */

function resolveCardImages(selectedCards) {
  return (selectedCards || []).map((id) => {
    const card = getTarotById(id);

    if (!card) {
      throw new Error(`Kart bulunamadı: ${id}`);
    }

    return card.image;
  });
}

/* =========================
   PICKED HELPER
========================= */

function toPicked(selectedCards, revealedCount) {
  return (selectedCards || []).slice(0, revealedCount).map((id) => {
    const card = getTarotById(id);

    if (!card) {
      throw new Error(`Kart bulunamadı: ${id}`);
    }

    return {
      id,
      image: card.image,
    };
  });
}

/* =========================
   FULL CARD DATA HELPER
========================= */

function toCards(selectedCards) {
  return (selectedCards || []).map((id) => {
    const card = getTarotById(id);

    if (!card) {
      throw new Error(`Kart bulunamadı: ${id}`);
    }

    return {
      id,
      image: card.image,
    };
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
- Minimum 1000 kelime yaz.
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
- Minimum 500 kelime olsun.
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

async function generateInterpretation({
  mode,
  subType,
  question,
  selectedCards,
}) {
  const prompt = buildPrompt({
    mode,
    subType,
    question,
    selectedCards,
  });

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("GPT timeout")), 45000)
  );

  const completion = await Promise.race([
    openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "Sen güçlü ve sezgisel bir tarot ustasısın.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.85,
    }),
    timeout,
  ]);

  return (completion?.choices?.[0]?.message?.content || "").trim();
}

/* =========================
   START
========================= */

export async function startTarot(uid, {
  mode,
  subType,
  question,
  coinPrice,
}) {
  if (!uid) {
    throw new Error("UID gerekli");
  }

  if (!coinPrice) {
    throw new Error("Coin price eksik");
  }

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
    .then((text) => {
      const t = (text || "").trim();

      if (!t) {
        return null;
      }

      return t;
    })
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

  return {
    sessionId,
    cardCount,
  };
}

/* =========================
   REVEAL
========================= */

export async function revealTarot(uid, { sessionId }) {
  const session = sessionStore.get(sessionId);

  if (!session) {
    throw new Error("Session yok");
  }

  if (session.uid !== uid) {
    throw new Error("Yetkisiz");
  }

  if (session.status === "completed") {
    throw new Error("Session tamamlandı");
  }

  if (session.status === "expired") {
    throw new Error("Session süresi doldu");
  }

  if (isExpired(session)) {
    session.status = "expired";
    sessionStore.delete(sessionId);
    throw new Error("Session süresi doldu");
  }

  if (session.processing) {
    throw new Error("Reveal zaten işleniyor");
  }

  session.processing = true;

  try {
    const nextIndex = session.revealed.length;

    if (nextIndex >= session.selectedCards.length) {
      throw new Error("Tüm kartlar açıldı");
    }

    const cardId = session.selectedCards[nextIndex];

    session.revealed.push(cardId);

    const picked = toPicked(
      session.selectedCards,
      session.revealed.length
    );

    if (session.revealed.length === session.selectedCards.length) {
      let interpretation = null;

      if (session.interpretationPromise) {
        interpretation = await session.interpretationPromise;
      }

      if (!interpretation) {
        try {
          interpretation = await generateInterpretation({
            mode: session.mode,
            subType: session.subType,
            question: session.question,
            selectedCards: session.selectedCards,
          });
        } catch (err) {
          console.error("GPT FALLBACK ERROR:", err);
          interpretation = null;
        }
      }

      if (!interpretation) {
        session.status = "expired";
        sessionStore.delete(sessionId);
        throw new Error("Yorum üretilemedi");
      }

      const remainingCoin = await decreaseCoin(
        uid,
        session.cost,
        "TAROT",
        {
          sessionId,
          mode: session.mode,
        }
      );

      const tarotType = resolveTarotType(
        session.mode,
        session.subType
      );

      const cardImages = resolveCardImages(
        session.selectedCards
      );

      const cards = toCards(
        session.selectedCards
      );

      const alreadyExists = await existsHistoryDoc(
        uid,
        sessionId
      );

      if (!alreadyExists) {
        await createHistoryDoc(uid, sessionId, {
          type: "tarot",

          tarotType,
          mode: session.mode,
          subType: session.subType || null,

          question: session.question || "",

          cardImages,
          cards,

          interpretation,

          remainingCoin,

          cost: session.cost,

          sessionId,

          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAtMs: Date.now(),
          createdAtDate: getIstanbulDateKey(),
          createdAtText: getIstanbulDateTimeText(),

          selectedCards: session.selectedCards,
        });
      }

      session.status = "completed";
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
  } finally {
    const s = sessionStore.get(sessionId);

    if (s) {
      s.processing = false;
    }
  }
}