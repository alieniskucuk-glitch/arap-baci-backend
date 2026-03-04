import crypto from "crypto";
import openai from "../config/openai.js";
import { decreaseCoin } from "../utils/coinManager.js";
import { getTarotById } from "../utils/tarotDeck.js";

/* =========================
   MEMORY SESSION STORE
========================= */

const sessionStore = new Map();
const SESSION_TTL = 1000 * 60 * 10;

function isExpired(session) {
  return Date.now() - session.createdAt > SESSION_TTL;
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
   START (GPT BURADA BAŞLAR)
========================= */

export async function startTarot(uid, { mode, subType, question, coinPrice }) {

  if (!uid) throw new Error("UID gerekli");
  if (!coinPrice) throw new Error("Coin price eksik");

  const cardCount = resolveCardCount(mode);
  const selectedCards = pickCards(cardCount);
  const sessionId = crypto.randomUUID();

  const interpretationPromise = generateInterpretation({
    mode,
    subType,
    question,
    selectedCards,
  }).catch(() => null);

  sessionStore.set(sessionId, {
    uid,
    mode,
    subType,
    question,
    selectedCards,
    revealed: [],
    interpretationPromise,
    cost: coinPrice,
    createdAt: Date.now(),
  });

  return { sessionId, cardCount };
}

/* =========================
   REVEAL (SON KARTTA COIN + GPT)
========================= */

export async function revealTarot(uid, { sessionId }) {

  const session = sessionStore.get(sessionId);
  if (!session) throw new Error("Session yok");
  if (session.uid !== uid) throw new Error("Yetkisiz");

  if (isExpired(session)) {
    sessionStore.delete(sessionId);
    throw new Error("Session süresi doldu");
  }

  const nextIndex = session.revealed.length;
  if (nextIndex >= session.selectedCards.length)
    throw new Error("Tüm kartlar açıldı");

  const cardId = session.selectedCards[nextIndex];
  session.revealed.push(cardId);

  const picked = toPicked(session.selectedCards, session.revealed.length);

  if (session.revealed.length === session.selectedCards.length) {

    const interpretation = await session.interpretationPromise;
    if (!interpretation) throw new Error("Yorum üretilemedi");

    const remainingCoin = await decreaseCoin(
      uid,
      session.cost,
      "TAROT",
      { sessionId, mode: session.mode }
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