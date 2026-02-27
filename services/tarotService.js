import { db } from "../config/firebase.js";
import { FieldValue } from "firebase-admin/firestore";
import { PRICING } from "../utils/pricing.js";
import openai from "../config/openai.js";
import { decreaseCoin } from "../utils/coinManager.js";

/* =========================
   HELPERS
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

function resolveCost(mode) {
  const c = PRICING.TAROT;
  switch (mode) {
    case "one":
      return c.ONE_CARD;
    case "two":
      return c.TWO_CARD;
    case "three":
      return c.THREE_CARD;
    case "five":
      return c.FIVE_CARD;
    case "celtic":
      return c.CELTIC_CROSS;
    default:
      throw new Error("Geçersiz tarot mode");
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
  return selectedCards.slice(0, revealedCount).map((id) => ({
    id,
    image: `${id}.webp`, // NOT: asset isimlerin farklıysa burada düzelt
  }));
}

/* =========================
   START
   - Sadece session açar (coin düşmez)
========================= */

export async function startTarot(uid, { mode, subType, question }) {
  if (!uid) throw new Error("UID gerekli");

  const cardCount = resolveCardCount(mode);
  const selectedCards = pickCards(cardCount);

  const sessionRef = db.collection("tarotSessions").doc();

  await sessionRef.set({
    uid,
    mode,
    subType: subType || null,
    question: question || null,
    cardCount,
    selectedCards,
    revealedCount: 0,
    completed: false,
    cost: resolveCost(mode), // bilgi amaçlı
    createdAt: FieldValue.serverTimestamp(),
  });

  return {
    sessionId: sessionRef.id,
    cardCount,
  };
}

/* =========================
   REVEAL
   - Her reveal’de sadece revealedCount artar
   - SON reveal’de:
     1) "complete lock" al (transaction)
     2) GPT üret (transaction DIŞI)
     3) coin düş (SONDA)
     4) session finalize et (transaction)
   - Böylece:
     ✅ sonsuz kart açma yok
     ✅ internet giderse coin boşa gitmez
     ✅ aynı anda iki istek gelirse 1 tanesi kazanır
========================= */

export async function revealTarot(uid, { sessionId }) {
  if (!uid) throw new Error("UID gerekli");
  if (!sessionId) throw new Error("sessionId gerekli");

  const sessionRef = db.collection("tarotSessions").doc(sessionId);

  // 1) Transaction: revealedCount artır / son kartta complete lock al
  const txResult = await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists) throw new Error("Session bulunamadı");

    const session = snap.data();
    if (session.uid !== uid) throw new Error("Yetkisiz erişim");

    if (session.completed) throw new Error("Fal zaten tamamlandı");

    const nextRevealed = Number(session.revealedCount || 0) + 1;
    const cardCount = Number(session.cardCount || 0);

    if (nextRevealed > cardCount) throw new Error("Tüm kartlar açıldı");

    const isLast = nextRevealed === cardCount;

    // revealedCount her durumda artar
    // SON kartta ayrıca "completed: true" ile kilitle (double request engeli)
    tx.update(sessionRef, {
      revealedCount: nextRevealed,
      ...(isLast ? { completed: true, completedAt: FieldValue.serverTimestamp() } : {}),
    });

    return {
      isLast,
      mode: session.mode,
      subType: session.subType || null,
      question: session.question || null,
      selectedCards: session.selectedCards || [],
      picked: toPicked(session.selectedCards || [], nextRevealed),
      cost: resolveCost(session.mode),
    };
  });

  // SON değilse direkt dön
  if (!txResult.isLast) {
    return { picked: txResult.picked };
  }

  // 2) GPT (transaction DIŞI)
  const spreadDescription = resolveSpreadDescription(txResult.mode) || "Tarot açılımı";

  const prompt = `
Sen deneyimli, mistik bir tarot yorumcususun.

Açılım Türü: ${spreadDescription}
Kart ID’leri: ${(txResult.selectedCards || []).join(", ")}
Alt kategori: ${txResult.subType || "Genel"}
Kullanıcının Sorusu: ${txResult.question || "Belirtilmedi"}

Kurallar:
- Spiritüel ama net ol.
- Korkutucu dil kullanma.
- Somut öneri ver.
- Sonunda kısa bir rehber paragraf ekle.
`.trim();

  let interpretation = "";
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Sen güçlü bir tarot rehberisin." },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
    });

    interpretation = (completion?.choices?.[0]?.message?.content || "").trim();
  } catch (e) {
    // GPT patlarsa: session kilitli kaldı ama coin düşmedi.
    // İstersen burada "completed=false" geri almak istersin ama o ayrı kural.
    throw new Error("Yorum üretilemedi");
  }

  // 3) Coin düş (SONDA) — burada yetersiz coin olursa error döner
  // Not: /start'ta coinCheck koyarsan bu zaten yakalanır.
  const remainingCoin = await decreaseCoin(uid, txResult.cost, "TAROT", {
    sessionId,
    mode: txResult.mode,
  });

  // 4) Session finalize (interpretation yaz)
  await sessionRef.update({
    interpretation,
    remainingCoin,
    cost: txResult.cost,
    finalizedAt: FieldValue.serverTimestamp(),
  });

  return {
    picked: txResult.picked,
    interpretation,
    remainingCoin,
  };
}