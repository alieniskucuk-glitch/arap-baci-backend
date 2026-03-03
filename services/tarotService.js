import { db } from "../config/firebase.js";
import { FieldValue } from "firebase-admin/firestore";
import openai from "../config/openai.js";
import { decreaseCoin } from "../utils/coinManager.js";
import { getTarotById } from "../utils/tarotDeck.js";

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
   START  (HIZLI - GPT YOK)
========================= */

export async function startTarot(uid, { mode, subType, question, coinPrice }) {
  if (!uid) throw new Error("UID gerekli");
  if (!coinPrice) throw new Error("Coin price eksik");

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

    // ✅ GPT start'ta yok
    interpretation: null,
    generating: false,

    completed: false,
    saved: false,
    cost: coinPrice,
    createdAt: FieldValue.serverTimestamp(),
  });

  return {
    sessionId: sessionRef.id,
    cardCount,
  };
}

/* =========================
   GENERATE (GPT BURADA)
========================= */

export async function generateTarotInterpretation(uid, { sessionId }) {
  if (!uid) throw new Error("UID gerekli");
  if (!sessionId) throw new Error("sessionId gerekli");

  const sessionRef = db.collection("tarotSessions").doc(sessionId);

  // ✅ aynı anda 2 generate olmasın + zaten üretildiyse tekrar üretme
  const { shouldGenerate, session } = await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists) throw new Error("Session bulunamadı");

    const s = snap.data();
    if (s.uid !== uid) throw new Error("Yetkisiz erişim");

    if (s.interpretation && String(s.interpretation).trim().length > 0) {
      return { shouldGenerate: false, session: s };
    }

    if (s.generating === true) {
      return { shouldGenerate: false, session: s };
    }

    tx.update(sessionRef, { generating: true });
    return { shouldGenerate: true, session: s };
  });

  // zaten varsa ya da generating ise burada dön
  if (!shouldGenerate) {
    return {
      interpretation: session.interpretation || null,
      generating: session.generating === true,
    };
  }

  const prompt = buildPrompt({
    mode: session.mode,
    subType: session.subType,
    question: session.question,
    selectedCards: session.selectedCards,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "Sen güçlü ve sezgisel bir tarot ustasısın." },
        { role: "user", content: prompt },
      ],
      temperature: 0.85,
    });

    const interpretation = (completion?.choices?.[0]?.message?.content || "")
      .trim();

    await sessionRef.update({
      interpretation: interpretation || null,
      generating: false,
      generatedAt: FieldValue.serverTimestamp(),
    });

    return { interpretation: interpretation || null, generating: false };
  } catch (e) {
    // ✅ generating bayrağını geri kapat
    await sessionRef.update({ generating: false });
    throw new Error("Yorum üretilemedi");
  }
}

/* =========================
   REVEAL (SADECE GÖSTERİM)
========================= */

export async function revealTarot(uid, { sessionId }) {
  if (!uid) throw new Error("UID gerekli");
  if (!sessionId) throw new Error("sessionId gerekli");

  const sessionRef = db.collection("tarotSessions").doc(sessionId);

  const txResult = await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists) throw new Error("Session bulunamadı");

    const session = snap.data();
    if (session.uid !== uid) throw new Error("Yetkisiz erişim");

    const nextRevealed = Number(session.revealedCount || 0) + 1;
    if (nextRevealed > session.cardCount) throw new Error("Tüm kartlar açıldı");

    tx.update(sessionRef, { revealedCount: nextRevealed });

    return {
      picked: toPicked(session.selectedCards, nextRevealed),
      interpretation: session.interpretation || null, // ✅ null olabilir
      generating: session.generating === true,
      cost: session.cost,
    };
  });

  return txResult;
}

/* =========================
   RESULT AÇILDIĞINDA COIN DÜŞ
========================= */

export async function finalizeTarot(uid, { sessionId }) {
  if (!uid) throw new Error("UID gerekli");
  if (!sessionId) throw new Error("sessionId gerekli");

  const sessionRef = db.collection("tarotSessions").doc(sessionId);
  const snap = await sessionRef.get();

  if (!snap.exists) throw new Error("Session yok");
  const session = snap.data();

  if (session.uid !== uid) throw new Error("Yetkisiz erişim");
  if (session.completed) return { remainingCoin: session.remainingCoin };

  const remainingCoin = await decreaseCoin(uid, session.cost, "TAROT", {
    sessionId,
    mode: session.mode,
  });

  await sessionRef.update({
    completed: true,
    remainingCoin,
    finalizedAt: FieldValue.serverTimestamp(),
  });

  return { remainingCoin };
}

/* =========================
   KAYDET BUTONU
========================= */

export async function saveTarot(uid, { sessionId }) {
  if (!uid) throw new Error("UID gerekli");
  if (!sessionId) throw new Error("sessionId gerekli");

  const sessionRef = db.collection("tarotSessions").doc(sessionId);
  const snap = await sessionRef.get();

  if (!snap.exists) throw new Error("Session yok");
  const session = snap.data();
  if (session.uid !== uid) throw new Error("Yetkisiz erişim");

  await sessionRef.update({
    saved: true,
    savedAt: FieldValue.serverTimestamp(),
  });

  return { ok: true };
}