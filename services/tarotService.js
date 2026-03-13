import crypto from "crypto";
import openai from "../config/openai.js";
import { decreaseCoin } from "../utils/coinManager.js";
import { getTarotById } from "../utils/tarotDeck.js";
import { db, admin } from "../config/firebase.js";

/* =========================
   MEMORY SESSION STORE
========================= */

const sessionStore = new Map();

const SESSION_TTL = 1000 * 60 * 10; // 10 dakika
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

  return (selectedCards || [])
    .slice(0, revealedCount)
    .map((id) => {

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

async function getUserName(uid) {

  const snap = await db.collection("users").doc(uid).get();

  if (!snap.exists) return null;

  const data = snap.data();

  return data?.name || data?.displayName || null;
}


/* =========================
   PROMPT
========================= */

function buildPromptRouter(params) {

  const { mode, subType } = params;

  if (mode === "one") {
    return buildPromptOne(params);
  }

  if (mode === "two") {
    return buildPromptTwo(params);
  }

  if (mode === "three") {
    return buildPromptThree(params);
  }

  if (mode === "five" && subType === "general") {
    return buildPromptFiveGeneral(params);
  }

  if (mode === "five" && subType === "relationship") {
    return buildPromptFiveRelationship(params);
  }

  if (mode === "five" && subType === "spiritual") {
    return buildPromptFiveSpiritual(params);
  }

  if (mode === "celtic") {
    return buildPromptCeltic(params);
  }

  throw new Error("Prompt oluşturulamadı");
}


/* =========================================================
   PROMPT CONTEXT
========================================================= */

function buildPromptContext({ mode, subType, question, selectedCards, userName }) {

  const spreadDescription = resolveSpreadDescription(mode) || "Tarot açılımı";

  const questionText = question || "Belirtilmedi";

  const cardIds = (selectedCards || []).join(", ");

  const nameLine = userName
    ? `Kullanıcının adı: ${userName}`
    : "Kullanıcının adı belirtilmedi.";

  return {
    spreadDescription,
    questionText,
    cardIds,
    nameLine
  };
}


/* =========================================================
   PROMPT 1
========================================================= */

function buildPromptOne({ mode, subType, question, selectedCards, userName }) {

  const ctx = buildPromptContext({ mode, subType, question, selectedCards, userName });

  return `
Sen güçlü sezgilere sahip deneyimli, mistik bir tarot rehberisin.

Bu açılım tek karttır ve kartın mesajı kullanıcının şu anda duyması gereken en önemli farkındalığı temsil eder.

${ctx.nameLine}

Açılım Türü: ${ctx.spreadDescription}
Kart ID'leri: ${ctx.cardIds}
Kullanıcının Sorusu: ${ctx.questionText}

YAZIM KURALLARI
- Minimum 200 maksimum 250 kelime yaz
- Kartın temel mesajını açıkla
- Kart ID veya teknik analizden bahsetme
- Kullanıcının sorusuna doğrudan cevap ver
- Ruhsal ve psikolojik etkileri yorumla
- Son bölümde güçlü rehberlik mesajı ver

Eğer kullanıcının adı verilmişse yorum içinde en az bir kez adıyla hitap et.

Yorum doğrudan başlasın.
`.trim();
}


/* =========================================================
   PROMPT 2
========================================================= */

function buildPromptTwo({ mode, subType, question, selectedCards, userName }) {

  const ctx = buildPromptContext({ mode, subType, question, selectedCards, userName });

  return `
Sen ikili enerji çatışmalarını yorumlayan deneyimli bir tarot ustasısın.

${ctx.nameLine}

Açılım Türü: ${ctx.spreadDescription}
Kart ID'leri: ${ctx.cardIds}
Kullanıcının Sorusu: ${ctx.questionText}

YAZIM KURALLARI
- Minimum 350 maksimum 450 kelime yaz
- Kart ID veya teknik analizden bahsetme
- İlk kart mevcut enerjiyi açıklar
- İkinci kart karşıt veya gizli enerjiyi açıklar
- Kartlar arası enerji çatışmasını yorumla
- Duygusal ve psikolojik etkileri değerlendir

Yorum doğrudan başlasın.
`.trim();
}


/* =========================================================
   PROMPT 3
========================================================= */

function buildPromptThree({ mode, subType, question, selectedCards, userName }) {

  const ctx = buildPromptContext({ mode, subType, question, selectedCards, userName });

  return `
Sen zaman enerjilerini yorumlayan deneyimli bir tarot rehberisin.

${ctx.nameLine}

Açılım Türü: ${ctx.spreadDescription}
Kart ID'leri: ${ctx.cardIds}
Kullanıcının Sorusu: ${ctx.questionText}

YAZIM KURALLARI
- Minimum 650 maksimum 720 kelime yaz
- Kart ID veya teknik analizden bahsetme
- İlk kart geçmiş etkileri
- İkinci kart mevcut enerjiyi
- Üçüncü kart gelecek yönelimini anlatır
- Kartlar arası zaman köprüsünü kur
- Son bölümde rehberlik ver

Yorum doğrudan başlasın.
`.trim();
}


/* =========================================================
   PROMPT 5 GENERAL
========================================================= */

function buildPromptFiveGeneral({ mode, subType, question, selectedCards, userName }) {

  const ctx = buildPromptContext({ mode, subType, question, selectedCards, userName });

  return `
Sen hayatın genel akışını yorumlayan deneyimli bir tarot danışmanısın.

${ctx.nameLine}

Açılım Türü: ${ctx.spreadDescription}
Kart ID'leri: ${ctx.cardIds}
Kullanıcının Sorusu: ${ctx.questionText}

YAZIM KURALLARI
- Minimum 950 maksimum 1100 kelime yaz
- Kart ID veya teknik analizden bahsetme
- Her kartı ayrı analiz et
- Fırsatları ve blokajları açıkla
- Maddi duygusal ruhsal etkileri değerlendir
- Sonunda net rehberlik ver

Yorum doğrudan başlasın.
`.trim();
}


/* =========================================================
   PROMPT 5 RELATIONSHIP
========================================================= */

function buildPromptFiveRelationship({ mode, subType, question, selectedCards, userName }) {

  const ctx = buildPromptContext({ mode, subType, question, selectedCards, userName });

  return `
Sen ilişkisel enerji analizinde uzman bir tarot ustasısın.

${ctx.nameLine}

Açılım Türü: ${ctx.spreadDescription}
Kart ID'leri: ${ctx.cardIds}
Kullanıcının Sorusu: ${ctx.questionText}

YAZIM KURALLARI
- Minimum 950 maksimum 1100 kelime yaz
- Kart ID veya teknik analizden bahsetme
- Kullanıcının duygusal durumunu analiz et
- Karşı tarafın enerjisini yorumla
- İlişki içindeki blokajları açıkla
- Geleceğe dair yönelim ver

Yorum doğrudan başlasın.
`.trim();
}


/* =========================================================
   PROMPT 5 SPIRITUAL
========================================================= */

function buildPromptFiveSpiritual({ mode, subType, question, selectedCards, userName }) {

  const ctx = buildPromptContext({ mode, subType, question, selectedCards, userName });

  return `
Sen ruhsal gelişimi yorumlayan mistik bir tarot rehberisin.

${ctx.nameLine}

Açılım Türü: ${ctx.spreadDescription}
Kart ID'leri: ${ctx.cardIds}
Kullanıcının Sorusu: ${ctx.questionText}

YAZIM KURALLARI
- Minimum 950 maksimum 1100 kelime yaz
- Kart ID veya teknik analizden bahsetme
- Ruhsal dersleri yorumla
- Bırakılması gereken enerjileri açıkla
- İçsel dönüşüm sürecini anlat
- Ruhsal rehberlik ver

Yorum doğrudan başlasın.
`.trim();
}


/* =========================================================
   PROMPT CELTIC
========================================================= */

function buildPromptCeltic({ mode, subType, question, selectedCards, userName }) {

  const ctx = buildPromptContext({ mode, subType, question, selectedCards, userName });

  return `
Sen kader analizi yapan deneyimli bir tarot ustasısın.

${ctx.nameLine}

Açılım Türü: ${ctx.spreadDescription}
Kart ID'leri: ${ctx.cardIds}
Kullanıcının Sorusu: ${ctx.questionText}

YAZIM KURALLARI
- Minimum 1500 maksimum 1700 kelime yaz
- En az 10 paragraf oluştur
- Her kartı pozisyonuna göre analiz et
- Bilinçaltı etkileri açıkla
- Karmik bağları yorumla
- Kartlar arası enerji akışını anlat
- Maddi duygusal ruhsal etkileri değerlendir
- Sonunda güçlü rehberlik mesajı ver

Yorum doğrudan başlasın.
`.trim();
}

/* =========================
   GPT (timeout eklendi)
========================= */

async function generateInterpretation({
  mode,
  subType,
  question,
  selectedCards,
  userName
}) {

  const prompt = buildPromptRouter({
    mode,
    subType,
    question,
    selectedCards,
    userName
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
          content: "Sen güçlü sezgilere sahip deneyimli bir tarot ustasısın."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.85
    }),
    timeout
  ]);

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

  const userName = await getUserName(uid);

  const sessionId = crypto.randomUUID();
  const createdAt = Date.now();

  await createSessionDoc(sessionId, {
    uid,
    mode,
    subType: subType || null,
    question: question || null,
    userName: userName || null,
    selectedCards,
    revealed: [],
    cost: coinPrice,
    createdAt,
    status: "active",
    interpretation: null,
    interpretationReadyAt: null,
    processing: false
  });

  const interpretationPromise = generateInterpretation({
    mode,
    subType,
    question,
    selectedCards,
    userName
  })
    .then(async (text) => {

      const t = (text || "").trim();

      if (t) {
        await updateSessionDoc(sessionId, {
          interpretation: t,
          interpretationReadyAt: Date.now()
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
    userName,
    mode,
    subType,
    question,
    selectedCards,
    revealed: [],
    interpretationPromise,
    cost: coinPrice,
    createdAt,
    processing: false,
    status: "active"
  });

  return {
    sessionId,
    cardCount
  };
}


/* =========================
   REVEAL
========================= */

export async function revealTarot(uid, { sessionId }) {

  let session = sessionStore.get(sessionId);

  if (!session) {

    const doc = await getSessionDoc(sessionId);

    if (!doc) throw new Error("Session yok");

    session = {
      uid: doc.uid,
      userName: doc.userName || null,
      mode: doc.mode,
      subType: doc.subType || null,
      question: doc.question || null,
      selectedCards: doc.selectedCards || [],
      revealed: doc.revealed || [],
      interpretationPromise: null,
      cost: doc.cost,
      createdAt: doc.createdAt,
      processing: !!doc.processing,
      status: doc.status || "active"
    };

    sessionStore.set(sessionId, session);
  }

  if (session.uid !== uid) throw new Error("Yetkisiz");

  if (session.status === "completed") throw new Error("Session tamamlandı");
  if (session.status === "expired") throw new Error("Session süresi doldu");

  if (isExpired(session)) {

    await markExpired(sessionId);

    sessionStore.delete(sessionId);

    throw new Error("Session süresi doldu");

  }

  const docCheck = await getSessionDoc(sessionId);

  if (session.processing || docCheck?.processing) {
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

    await updateSessionDoc(sessionId, {
      revealed: session.revealed
    });

    const picked = toPicked(session.selectedCards, session.revealed.length);

    if (session.revealed.length === session.selectedCards.length) {

      let interpretation = null;

      const docNow = await getSessionDoc(sessionId);

      if (docNow && typeof docNow.interpretation === "string") {

        const t = docNow.interpretation.trim();

        if (t) interpretation = t;

      }

      if (!interpretation && session.interpretationPromise) {

        interpretation = await session.interpretationPromise;

      }

      if (!interpretation) {

        try {

          interpretation = await generateInterpretation({
            mode: session.mode,
            subType: session.subType,
            question: session.question,
            selectedCards: session.selectedCards,
            userName: session.userName
          });

        } catch (err) {

          console.error("GPT FALLBACK ERROR:", err);

          interpretation = null;

        }

        if (interpretation) {

          await updateSessionDoc(sessionId, {
            interpretation: interpretation.trim(),
            interpretationReadyAt: Date.now()
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

      await markCompleted(sessionId, {
        remainingCoin
      });

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

  } finally {

    const s = sessionStore.get(sessionId);

    if (s) s.processing = false;

    try {
      await updateSessionDoc(sessionId, { processing: false });
    } catch (_) {}

  }
}