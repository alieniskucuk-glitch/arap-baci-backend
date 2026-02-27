import { db } from "../config/firebase.js";
import { FieldValue } from "firebase-admin/firestore";
import { decreaseCoin } from "../utils/coinManager.js";
import { PRICING } from "../utils/pricing.js";
import openai from "../config/openai.js";

// ================= HELPERS =================

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

function resolveCost(mode) {
  switch (mode) {
    case "one": return PRICING.TAROT.ONE_CARD;
    case "two": return PRICING.TAROT.TWO_CARD;
    case "three": return PRICING.TAROT.THREE_CARD;
    case "five": return PRICING.TAROT.FIVE_CARD;
    case "celtic": return PRICING.TAROT.CELTIC_CROSS;
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

// ================= START =================

export async function startTarot(uid, { mode, subType, question }) {

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
    completed: false, // 🔥 önemli
    createdAt: FieldValue.serverTimestamp(),
  });

  return {
    sessionId: sessionRef.id,
    cardCount,
  };
}

// ================= REVEAL =================

export async function revealTarot(uid, { sessionId }) {

  const sessionRef = db.collection("tarotSessions").doc(sessionId);

  return await db.runTransaction(async (tx) => {

    const snap = await tx.get(sessionRef);
    if (!snap.exists) throw new Error("Session bulunamadı");

    const session = snap.data();

    if (session.uid !== uid)
      throw new Error("Yetkisiz erişim");

    if (session.completed)
      throw new Error("Fal zaten tamamlandı");

    if (session.revealedCount >= session.cardCount)
      throw new Error("Tüm kartlar açıldı");

    const nextRevealed = session.revealedCount + 1;

    tx.update(sessionRef, {
      revealedCount: nextRevealed,
    });

    const picked = session.selectedCards
      .slice(0, nextRevealed)
      .map(id => ({
        id,
        image: `${id}.webp`
      }));

    const isLast = nextRevealed === session.cardCount;

    if (!isLast) {
      return { picked };
    }

    // ================= GPT =================

    const spreadDescription = {
      one: "Tek kart ilahi mesaj",
      two: "Durum ve karşıt enerji",
      three: "Geçmiş - Şimdi - Gelecek",
      five: "Detaylı rehberlik açılımı",
      celtic: "Kelt Haçı kapsamlı kader analizi"
    }[session.mode];

    const prompt = `
Sen deneyimli, mistik bir tarot yorumcususun.

Açılım Türü: ${spreadDescription}
Kart ID’leri: ${session.selectedCards.join(", ")}
Alt kategori: ${session.subType || "Genel"}
Kullanıcının Sorusu: ${session.question || "Belirtilmedi"}

Kurallar:
- Spiritüel ama net ol.
- Korkutucu dil kullanma.
- Somut öneri ver.
- Sonunda kısa bir rehber paragraf ekle.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Sen güçlü bir tarot rehberisin." },
        { role: "user", content: prompt }
      ],
      temperature: 0.8,
    });

    const interpretation = completion.choices[0].message.content;

    // ================= COIN DÜŞ =================

    const cost = resolveCost(session.mode);
    const remainingCoin = await decreaseCoin(uid, cost, "TAROT", {
      sessionId
    });

    tx.update(sessionRef, {
      interpretation,
      cost,
      completed: true, // 🔥 tekrar reveal engeli
      completedAt: FieldValue.serverTimestamp(),
    });

    return {
      picked,
      interpretation,
      remainingCoin,
    };
  });
}