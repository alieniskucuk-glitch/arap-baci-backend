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
const SESSIONS_COL = "tarotSessions";

function isExpired(session) {
  return Date.now() - session.createdAt > SESSION_TTL;
}

function sessionRef(sessionId) {
  return db.collection(SESSIONS_COL).doc(sessionId);
}

async function existsSessionDoc(sessionId) {
  const snap = await sessionRef(sessionId).get();
  return snap.exists;
}

async function createSessionDoc(sessionId, data) {
  await sessionRef(sessionId).set(data, { merge: false });
}

async function getSessionDoc(sessionId) {
  const snap = await sessionRef(sessionId).get();
  if (!snap.exists) return null;
  return snap.data();
}

async function updateSessionDoc(sessionId, patch) {
  await sessionRef(sessionId).set(patch, { merge: true });
}

async function markCompleted(sessionId, patch = {}) {
  await updateSessionDoc(sessionId, {
    status: "completed",
    completedAt: Date.now(),
    ...patch,
  });
}

async function markExpired(sessionId) {
  await updateSessionDoc(sessionId, {
    status: "expired",
    expiredAt: Date.now(),
  });
}

/* =========================
   HELPERS (AYNEN)
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
    if (!card) throw new Error(`Kart bulunamadı: ${id}`);
    return { id, image: card.image };
  });
}

/* =========================
   PROMPT (DOKUNMADIM)
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

async function generateInterpretation({ mode, subType, question, selectedCards }) {
  const prompt = buildPrompt({ mode, subType, question, selectedCards });

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: "Sen güçlü ve sezgisel bir tarot ustasısın." },
      { role: "user", content: prompt },
    ],
    temperature: 0.85,
  });

  return (completion?.choices?.[0]?.message?.content || "").trim();
}

/* =========================
   START
========================= */

export async function startTarot(uid, { mode, subType, question, coinPrice }) {

  if (!uid) throw new Error("UID gerekli");
  if (!coinPrice) throw new Error("Coin price eksik");

  const cardCount = resolveCardCount(mode);
  const selectedCards = pickCards(cardCount);

  // ✅ sessionId çakışma olmasın (çok düşük ihtimal ama garanti)
  let sessionId = crypto.randomUUID();
  for (let i = 0; i < 5; i++) {
    // Firestore'da var mı?
    // (varsa yeniden üret)
    // (5 denemede de olursa error)
    // NOTE: ultra düşük ihtimal.
    // eslint-disable-next-line no-await-in-loop
    const exists = await existsSessionDoc(sessionId);
    if (!exists) break;
    sessionId = crypto.randomUUID();
    if (i === 4) throw new Error("Session üretilemedi");
  }

  const createdAt = Date.now();

  // ✅ Firestore'a yaz (restart olunca kaybolmasın)
  await createSessionDoc(sessionId, {
    uid,
    mode,
    subType: subType || null,
    question: question || null,
    selectedCards,
    revealed: [],
    cost: coinPrice,
    createdAt,
    status: "active",
    interpretation: null,
    interpretationReadyAt: null,
    processing: false,
  });

  // ✅ memory cache (performans)
  const interpretationPromise = generateInterpretation({
    mode,
    subType,
    question,
    selectedCards,
  })
    .then(async (text) => {
      const t = (text || "").trim();
      if (t) {
        await updateSessionDoc(sessionId, {
          interpretation: t,
          interpretationReadyAt: Date.now(),
        });
      }
      return t || null;
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

  return { sessionId, cardCount };
}

/* =========================
   REVEAL
========================= */

export async function revealTarot(uid, { sessionId }) {

  // ✅ önce memory dene
  let session = sessionStore.get(sessionId);

  // ✅ memory yoksa Firestore'dan yükle (restart senaryosu)
  if (!session) {
    const doc = await getSessionDoc(sessionId);
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

  if (!session) throw new Error("Session yok");
  if (session.uid !== uid) throw new Error("Yetkisiz");

  // ✅ completed/expired tekrar kullanılmasın
  if (session.status === "completed") throw new Error("Session tamamlandı");
  if (session.status === "expired") throw new Error("Session süresi doldu");

  if (isExpired(session)) {
    await markExpired(sessionId);
    sessionStore.delete(sessionId);
    throw new Error("Session süresi doldu");
  }

  /* 🔒 CONCURRENCY LOCK (memory + firestore) */
  if (session.processing) {
    throw new Error("Reveal zaten işleniyor");
  }

  session.processing = true;
  await updateSessionDoc(sessionId, { processing: true });

  try {

    const nextIndex = session.revealed.length;
    if (nextIndex >= session.selectedCards.length)
      throw new Error("Tüm kartlar açıldı");

    const cardId = session.selectedCards[nextIndex];

    session.revealed.push(cardId);

    // ✅ Firestore'a revealed yaz
    await updateSessionDoc(sessionId, {
      revealed: session.revealed,
    });

    const picked = toPicked(session.selectedCards, session.revealed.length);

    if (session.revealed.length === session.selectedCards.length) {

      // ✅ interpretation hazır mı? (restart olduysa promise yok)
      let interpretation = null;

      const docNow = await getSessionDoc(sessionId);
      if (docNow && typeof docNow.interpretation === "string") {
        const t = docNow.interpretation.trim();
        if (t) interpretation = t;
      }

      if (!interpretation) {
        // memory promise varsa bekle
        if (session.interpretationPromise) {
          interpretation = await session.interpretationPromise;
        }
      }

      if (!interpretation) {
        // ✅ fallback: yeniden üret (restart sonrası garanti)
        interpretation = await generateInterpretation({
          mode: session.mode,
          subType: session.subType,
          question: session.question,
          selectedCards: session.selectedCards,
        }).catch((err) => {
          console.error("GPT ERROR (fallback):", err);
          return null;
        });

        if (interpretation && interpretation.trim()) {
          await updateSessionDoc(sessionId, {
            interpretation: interpretation.trim(),
            interpretationReadyAt: Date.now(),
          });
        }
      }

      if (!interpretation) {
        await markExpired(sessionId);
        sessionStore.delete(sessionId);
        throw new Error("Yorum üretilemedi");
      }

      const remainingCoin = await decreaseCoin(
        uid,
        session.cost,
        "TAROT",
        { sessionId, mode: session.mode }
      );

      // ✅ completed olarak işaretle (replay engeli)
      await markCompleted(sessionId, {
        remainingCoin,
      });

      // ✅ memory temizle (istersen kalsın ama replay için temizlemek iyi)
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
    // ✅ lock bırak (memory + firestore)
    const s = sessionStore.get(sessionId);
    if (s) s.processing = false;

    try {
      await updateSessionDoc(sessionId, { processing: false });
    } catch (_) {}
  }
}