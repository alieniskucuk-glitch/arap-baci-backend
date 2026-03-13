import crypto from "crypto";
import openai from "../config/openai.js";
import { decreaseCoin } from "../utils/coinManager.js";
import { getTarotById } from "../utils/tarotDeck.js";
import { db, admin } from "../config/firebase.js";

/* =========================================================
   TAROT SERVICE
   - 29 başlıklı full professional yapı
   - Bu dosya modüler section mantığıyla ilerleyecek
   - İlk parçada sadece ilk 2 başlık yer alır
========================================================= */

/* =========================================================
   MEMORY SESSION STORE
========================================================= */

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
/* =========================================================
   CONSTANTS
========================================================= */

const ALLOWED_MODES = Object.freeze([
  "one",
  "two",
  "three",
  "five",
  "celtic",
]);

const ALLOWED_FIVE_SUBTYPES = Object.freeze([
  "general",
  "relationship",
  "spiritual",
]);

const DEFAULT_SYSTEM_PROMPT =
  "Sen tecrubeli, güçlü, sezgisel, derin analiz yapan ve kullanıcıya sahici rehberlik sunan mistik bir tarot ustasısın.";

const OPENAI_MODEL = "gpt-4.1-mini";
const OPENAI_TIMEOUT_MS = 45000;

/* =========================================================
   BASIC SESSION HELPERS
========================================================= */

function getSessionFromMemory(sessionId) {
  return sessionStore.get(sessionId) || null;
}

function putSessionInMemory(sessionId, session) {
  sessionStore.set(sessionId, session);
}

function removeSessionFromMemory(sessionId) {
  sessionStore.delete(sessionId);
}

function buildHydratedSessionFromDoc(doc) {
  return {
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
}

function buildCreateSessionPayload({
  uid,
  mode,
  subType,
  question,
  selectedCards,
  coinPrice,
  createdAt,
}) {
  return {
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
  };
}

async function hydrateSessionFromDoc(sessionId) {
  const doc = await getSessionDoc(sessionId);
  if (!doc) return null;
  return buildHydratedSessionFromDoc(doc);
}

async function ensureUniqueSessionId() {
  let sessionId = crypto.randomUUID();

  while (await existsSessionDoc(sessionId)) {
    sessionId = crypto.randomUUID();
  }

  return sessionId;
}

async function persistInterpretationIfAny(sessionId, text) {
  const t = (text || "").trim();

  if (!t) return null;

  await updateSessionDoc(sessionId, {
    interpretation: t,
    interpretationReadyAt: Date.now(),
  });

  return t;
}

async function readStoredInterpretation(sessionId) {
  const doc = await getSessionDoc(sessionId);
  if (!doc) return null;

  if (typeof doc.interpretation !== "string") {
    return null;
  }

  const t = doc.interpretation.trim();
  return t || null;
}

async function lockSessionProcessing(sessionId) {
  await updateSessionDoc(sessionId, { processing: true });
}

async function unlockSessionProcessing(sessionId) {
  await updateSessionDoc(sessionId, { processing: false });
}

/* =========================================================
   MEMORY CLEANUP
========================================================= */

setInterval(() => {

  const now = Date.now();

  for (const [sessionId, session] of sessionStore) {

    if (now - session.createdAt > SESSION_TTL) {
      sessionStore.delete(sessionId);
    }

  }

}, 60000);

/* =========================================================
   NORMALIZERS
========================================================= */

function normalizeString(value) {
  if (typeof value !== "string") return null;

  const v = value.trim();
  return v.length ? v : null;
}

function normalizeMode(mode) {
  const m = normalizeString(mode);
  return m ? m.toLowerCase() : null;
}

function normalizeSubType(subType) {
  const s = normalizeString(subType);
  return s ? s.toLowerCase() : null;
}

function normalizeQuestion(question) {
  const q = normalizeString(question);
  return q || null;
}

function normalizeSessionId(sessionId) {
  const s = normalizeString(sessionId);
  return s || null;
}

/* =========================================================
   VALIDATORS
========================================================= */

function validateUid(uid) {
  if (!uid || typeof uid !== "string") {
    throw new Error("UID gerekli");
  }
}

function validateCoinPrice(coinPrice) {
  if (coinPrice == null) {
    throw new Error("Coin price eksik");
  }

  if (
    typeof coinPrice !== "number" ||
    Number.isNaN(coinPrice) ||
    !Number.isFinite(coinPrice) ||
    coinPrice <= 0
  ) {
    throw new Error("Geçersiz coin price");
  }
}

function validateMode(mode) {
  if (!mode) {
    throw new Error("Mode gerekli");
  }

  if (!ALLOWED_MODES.includes(mode)) {
    throw new Error("Geçersiz tarot mode");
  }
}

function validateSubTypeForMode(mode, subType) {
  if (mode === "five") {
    if (!subType) {
      throw new Error("five mode için subType gerekli");
    }

    if (!ALLOWED_FIVE_SUBTYPES.includes(subType)) {
      throw new Error("Geçersiz five subType");
    }

    return;
  }

  if (subType) {
    throw new Error("subType sadece five mode için kullanılabilir");
  }
}

function validateQuestion(question) {
  if (question == null) return;

  if (typeof question !== "string") {
    throw new Error("Question metin olmalı");
  }
}

function validateSelectedCards(selectedCards, expectedCount) {
  if (!Array.isArray(selectedCards)) {
    throw new Error("selectedCards array olmalı");
  }

  if (selectedCards.length !== expectedCount) {
    throw new Error("Kart sayısı mode ile eşleşmiyor");
  }

  const set = new Set(selectedCards);

  if (set.size !== selectedCards.length) {
    throw new Error("Aynı kart birden fazla seçilemez");
  }

  for (const id of selectedCards) {
    if (!Number.isInteger(id)) {
      throw new Error("Kart ID geçersiz");
    }

    if (id < 0 || id > 77) {
      throw new Error("Kart ID aralık dışı");
    }
  }
}

function validateStartInput({ uid, mode, subType, question, coinPrice }) {
  validateUid(uid);
  validateQuestion(question);
  validateCoinPrice(coinPrice);
  validateMode(mode);
  validateSubTypeForMode(mode, subType);
}

function validateRevealInput({ uid, sessionId }) {
  validateUid(uid);

  if (!sessionId) {
    throw new Error("SessionId gerekli");
  }
}

/* =========================================================
   MODE HELPERS
========================================================= */

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

function resolveSpreadDescription(mode, subType) {
  if (mode === "five") {
    if (subType === "general") return "5 Kart Genel Rehberlik Açılımı";
    if (subType === "relationship") return "5 Kart İlişki Analizi Açılımı";
    if (subType === "spiritual") return "5 Kart Ruhsal Yolculuk Açılımı";
    return "5 Kart Detaylı Rehberlik Açılımı";
  }

  return {
    one: "Tek Kart İlahi Mesaj",
    two: "İki Kart Durum ve Karşıt Enerji",
    three: "Üç Kart Geçmiş - Şimdi - Gelecek",
    five: "Beş Kart Detaylı Rehberlik",
    celtic: "Kelt Haçı Kapsamlı Kader Analizi",
  }[mode];
}

function resolveModeLabel(mode) {
  return {
    one: "one",
    two: "two",
    three: "three",
    five: "five",
    celtic: "celtic",
  }[mode];
}

function resolveSubTypeLabel(subType) {
  if (!subType) return "Genel";

  return {
    general: "Genel",
    relationship: "İlişki",
    spiritual: "Ruhsal",
  }[subType] || "Genel";
}

function resolvePromptVariantKey(mode, subType) {
  if (mode === "one") return "one";
  if (mode === "two") return "two";
  if (mode === "three") return "three";
  if (mode === "celtic") return "celtic";

  if (mode === "five" && subType === "general") return "five_general";
  if (mode === "five" && subType === "relationship") return "five_relationship";
  if (mode === "five" && subType === "spiritual") return "five_spiritual";

  throw new Error("Prompt varyantı çözümlenemedi");
}
/* =========================================================
   CARD HELPERS
========================================================= */

function getCardSafe(id) {
  const card = getTarotById(id);

  if (!card) {
    throw new Error(`Kart bulunamadı: ${id}`);
  }

  return card;
}

function buildCardIdentityLines(selectedCards) {
  return (selectedCards || [])
    .map((id, index) => {
      const card = getCardSafe(id);
      const name = card.name || `Kart ${id}`;
      return `${index + 1}. kart => ID: ${id}, İsim: ${name}`;
    })
    .join("\n");
}

function buildCardNameCsv(selectedCards) {
  return (selectedCards || [])
    .map((id) => {
      const card = getCardSafe(id);
      return card.name || `Kart ${id}`;
    })
    .join(", ");
}

function toPicked(selectedCards, revealedCount) {
  return (selectedCards || []).slice(0, revealedCount).map((id) => {
    const card = getCardSafe(id);

    return {
      id,
      image: card.image,
    };
  });
}


/* =========================================================
   POSITION HELPERS
========================================================= */

function resolveOneCardPositionGuide() {
  return [
    "Bu tek kart kullanıcının şu anda en çok duyması gereken ana mesajı temsil eder.sorduğu sorunun net cevabını verir.",
  ].join("\n");
}

function resolveTwoCardPositionGuide() {
  return [
    "1. kart: mevcut ana enerji, kullanıcının şu anda içinde bulunduğu temel durum.",
    "2. kart: karşıt enerji, gizli etki, engel, destek veya dengeleyici unsur.",
  ].join("\n");
}

function resolveThreeCardPositionGuide() {
  return [
    "1. kart: geçmişten bugüne taşınan kök etki.",
    "2. kart: şu andaki aktif enerji ve merkez durum.",
    "3. kart: yakın gelecek yönelimi ve muhtemel sonuç çizgisi.",
  ].join("\n");
}

function resolveFiveGeneralPositionGuide() {
  return [
    "1. kart: mevcut durumun merkez enerjisi.",
    "2. kart: görünmeyen etki veya arka planda çalışan dinamik.",
    "3. kart: güçlü yön, fırsat veya açılmak isteyen kapı.",
    "4. kart: zorluk, tıkanıklık, korku veya geciktirici enerji.",
    "5. kart: rehberlik, yön ve yaklaşan sonuç eğilimi.",
  ].join("\n");
}

function resolveFiveRelationshipPositionGuide() {
  return [
    "1. kart: kullanıcının ilişkideki duygusal duruşu.",
    "2. kart: karşı tarafın enerjisi veya yansıyan etki.",
    "3. kart: bağın özü, görünmeyen çekim veya temel sorun.",
    "4. kart: ilişkiyi zorlayan iç/dış blokaj.",
    "5. kart: ilişkinin yönü ve rehberlik mesajı.",
  ].join("\n");
}

function resolveFiveSpiritualPositionGuide() {
  return [
    "1. kart: ruhun şu anki dersi.",
    "2. kart: bırakılması gereken eski enerji veya yük.",
    "3. kart: açılmakta olan sezgisel kapı veya içsel güç.",
    "4. kart: ruhsal blokaj veya fark edilmesi gereken gölge alan.",
    "5. kart: yükseliş yönü ve ilahi rehberlik.",
  ].join("\n");
}

function resolveCelticPositionGuide() {
  return [
    "1. kart: mevcut durumun kalbi.",
    "2. kart: çapraz etki, engel veya itici güç.",
    "3. kart: bilinç seviyesi, akıldaki odak.",
    "4. kart: bilinçaltı, kök enerji, görünmeyen temel.",
    "5. kart: geçmişte kalan ama hâlâ etkisi süren unsur.",
    "6. kart: yakın geleceğe açılan kapı.",
    "7. kart: kişinin kendini konumlayışı.",
    "8. kart: dış çevre, insanlar, koşullar.",
    "9. kart: umutlar, korkular, iç gerilimler.",
    "10. kart: olası sonuç ve enerjinin vardığı yön.",
  ].join("\n");
}

function resolvePositionGuide(mode, subType) {

  if (mode === "one") return resolveOneCardPositionGuide();
  if (mode === "two") return resolveTwoCardPositionGuide();
  if (mode === "three") return resolveThreeCardPositionGuide();
  if (mode === "celtic") return resolveCelticPositionGuide();

  if (mode === "five" && subType === "general") {
    return resolveFiveGeneralPositionGuide();
  }

  if (mode === "five" && subType === "relationship") {
    return resolveFiveRelationshipPositionGuide();
  }

  if (mode === "five" && subType === "spiritual") {
    return resolveFiveSpiritualPositionGuide();
  }

  throw new Error("Pozisyon rehberi oluşturulamadı");
}


/* =========================================================
   PROMPT CONTEXT HELPERS
========================================================= */

function buildPromptContext({ mode, subType, question, selectedCards }) {

  const spreadDescription = resolveSpreadDescription(mode, subType) || "Tarot açılımı";
  const promptVariant = resolvePromptVariantKey(mode, subType);
  const questionText = question || "Belirtilmedi";

  const cardIds = (selectedCards || []).join(", ");

  const cardIdentityLines = buildCardIdentityLines(selectedCards);
  const cardNameCsv = buildCardNameCsv(selectedCards);
  const positionGuide = resolvePositionGuide(mode, subType);

  return {
    spreadDescription,
    promptVariant,
    questionText,
    cardIds,
    cardIdentityLines,
    cardNameCsv,
    positionGuide,
  };
}
/* =========================================================
   7 FARKLI PROMPT BUILDER
========================================================= */

function buildPromptOne({ mode, subType, question, selectedCards }) {

  const ctx = buildPromptContext({ mode, subType, question, selectedCards });

  return `
Sen güçlü sezgilere sahip deneyimli, mistik bir tarot rehberisin.

Bu açılım tek karttır ve kartın mesajı kullanıcının şu anda duyması gereken en önemli farkındalığı temsil eder, kart sorusunun net cevabını verir.

Açılım Türü: ${ctx.spreadDescription}
Kart ID'leri: ${ctx.cardIds}
Kullanıcının Sorusu: ${ctx.questionText}

Kart Bilgileri:
${ctx.cardIdentityLines}

YAZIM KURALLARI
- Minimum 200, maksimum 250 kelime yaz
- kartın temel mesajını açıkla
- kart Id si veya kartın nasıl analiz edildiği gibi bilgilerden kesinlikle bahsetme.
- Sorduğu sorunun cevabını seçilen kart üzerinden yorumla ve cevapla
- Ruhsal, psikolojik ve pratik etkileri birlikte yorumla
- Kullanıcının içsel durumunu sezgisel şekilde anlat
- Son bölümde güçlü bir rehberlik mesajı ver

Yorum doğrudan başlasın.
`.trim();

}

function buildPromptTwo({ mode, subType, question, selectedCards }) {

  const ctx = buildPromptContext({ mode, subType, question, selectedCards });

  return `
Sen ikili enerji çatışmalarını ve ilişkisel dinamikleri güçlü sezgilerle okuyabilen deneyimli ve mistik bir tarot ustasısın.

Bu iki kartlık açılımda kartlar birbirini tamamlayan veya zorlayan enerjileri temsil eder. kullanıcı seçilen bu iki kart ile sorduğu soruya rehberlik edilmesini ister.

Açılım Türü: ${ctx.spreadDescription}
Kart ID'leri: ${ctx.cardIds}
Kullanıcının Sorusu: ${ctx.questionText}

Kart Bilgileri:
${ctx.cardIdentityLines}

YAZIM KURALLARI
- Minimum 350, maksimum 450 kelime yaz
- kart Id si veya kartın nasıl analiz edildiği gibi bilgilerden kesinlikle bahsetme.
- İlk kart mevcut enerjiyi açıklar
- İkinci kart karşıt veya gizli enerjiyi açıklar
- Sorduğu sorunun cevabını seçilen kartlar üzerinden, Kartlar arası enerji çatışmasını, Duygusal ve psikolojik etkileri birlikte ele alarak yorumla ve cevapla


Yorum doğrudan başlasın.
`.trim();

}

function buildPromptThree({ mode, subType, question, selectedCards }) {

  const ctx = buildPromptContext({ mode, subType, question, selectedCards });

  return `
Sen zaman çizgisi enerjilerini yorumlayan deneyimli ve mistik bir tarot rehberisin.

Bu açılım geçmiş, şimdi ve gelecek akışını gösterir.

Açılım Türü: ${ctx.spreadDescription}
Kart ID'leri: ${ctx.cardIds}
Kullanıcının Sorusu: ${ctx.questionText}

Kart Bilgileri:
${ctx.cardIdentityLines}

YAZIM KURALLARI
- Minimum 650, maksimum 720 kelime yaz
- kart Id si veya kartın nasıl analiz edildiği gibi bilgilerden kesinlikle bahsetme.
- İlk kart geçmiş etkileri anlatır
- İkinci kart mevcut enerjiyi anlatır
- Üçüncü kart geleceğe açılan yönü açıklar
- Kartlar arası zaman köprüsünü kur
- Son olarak rehberlik edici bir sonuç bölümü yaz.

Yorum doğrudan başlasın.
`.trim();

}

function buildPromptFiveGeneral({ mode, subType, question, selectedCards }) {

  const ctx = buildPromptContext({ mode, subType, question, selectedCards });

  return `
Sen hayatın genel akışını, fırsatları ve blokajları okuyabilen güçlü ve mistik bir tarot danışmanısın.

Bu açılım genel rehberlik içindir.

Açılım Türü: ${ctx.spreadDescription}
Kart ID'leri: ${ctx.cardIds}
Kullanıcının Sorusu: ${ctx.questionText}

Kart Bilgileri:
${ctx.cardIdentityLines}

YAZIM KURALLARI
- Minimum 950, maksimum 1100 kelime yaz
- kart Id si veya kartın nasıl analiz edildiği gibi bilgilerden kesinlikle bahsetme.
- Her kartı ayrı analiz et
- Fırsatlar ve blokajları açıkla
- Maddi, duygusal ve ruhsal etkileri değerlendir
- Son bölümde net rehberlik ver

Yorum doğrudan başlasın.
`.trim();

}

function buildPromptFiveRelationship({ mode, subType, question, selectedCards }) {

  const ctx = buildPromptContext({ mode, subType, question, selectedCards });

  return `
Sen ilişkisel enerji analizinde uzman mistik bir tarot ustasısın.

Bu açılım ilişki dinamiklerini analiz eder.

Açılım Türü: ${ctx.spreadDescription}
Kart ID'leri: ${ctx.cardIds}
Kullanıcının Sorusu: ${ctx.questionText}

Kart Bilgileri:
${ctx.cardIdentityLines}

YAZIM KURALLARI
- Minimum 950, maksimum 1100 kelime yaz
- kart Id si veya kartın nasıl analiz edildiği gibi bilgilerden kesinlikle bahsetme.
- Kullanıcının duygusal durumunu analiz et
- Karşı tarafın enerjisini yorumla
- İlişki içindeki blokajları ve bağları açıkla
- Geleceğe dair gerçekçi yönelim ver

Yorum doğrudan başlasın.
`.trim();

}

function buildPromptFiveSpiritual({ mode, subType, question, selectedCards }) {

  const ctx = buildPromptContext({ mode, subType, question, selectedCards });

  return `
Sen ruhsal gelişim ve kader derslerini yorumlayan mistik bir tarot rehberisin.

Bu açılım ruhsal farkındalık içindir.

Açılım Türü: ${ctx.spreadDescription}
Kart ID'leri: ${ctx.cardIds}
Kullanıcının Sorusu: ${ctx.questionText}

Kart Bilgileri:
${ctx.cardIdentityLines}

YAZIM KURALLARI
- Minimum 950, maksimum 1100 kelime yaz
- kart Id si veya kartın nasıl analiz edildiği gibi bilgilerden kesinlikle bahsetme.
- Ruhsal dersleri yorumla
- Bırakılması gereken enerjileri açıkla
- İçsel dönüşüm sürecini anlat
- Kullanıcıya ruhsal rehberlik ver

Yorum doğrudan başlasın.
`.trim();

}

function buildPromptCeltic({ mode, subType, question, selectedCards }) {

  const ctx = buildPromptContext({ mode, subType, question, selectedCards });

  return `
Sen kader analizinde uzman 30 yıllık deneyimli ve mistik bir tarot ustasısın.

Bu açılım Kelt Haçı'dır ve derin kader analizi gerektirir.

Açılım Türü: ${ctx.spreadDescription}
Kart ID'leri: ${ctx.cardIds}
Kullanıcının Sorusu: ${ctx.questionText}

Kart Bilgileri:
${ctx.cardIdentityLines}

YAZIM KURALLARI
- Minimum 1500, maksimum 1700 kelime yaz
- kart Id si veya kartın nasıl analiz edildiği gibi bilgilerden kesinlikle bahsetme.
- En az 10 paragraf oluştur
- Her kartı bulunduğu pozisyona göre analiz et
- Karmik bağları ve bilinçaltı etkileri açıkla
- Kartlar arası enerji akışını yorumla
- Sonunda güçlü bir kader rehberliği mesajı ver

Yorum doğrudan başlasın.
`.trim();

}


/* =========================================================
   MAIN PROMPT ROUTER
========================================================= */

function buildPrompt({ mode, subType, question, selectedCards }) {

  const variant = resolvePromptVariantKey(mode, subType);

  switch (variant) {

    case "one":
      return buildPromptOne({ mode, subType, question, selectedCards });

    case "two":
      return buildPromptTwo({ mode, subType, question, selectedCards });

    case "three":
      return buildPromptThree({ mode, subType, question, selectedCards });

    case "five_general":
      return buildPromptFiveGeneral({ mode, subType, question, selectedCards });

    case "five_relationship":
      return buildPromptFiveRelationship({ mode, subType, question, selectedCards });

    case "five_spiritual":
      return buildPromptFiveSpiritual({ mode, subType, question, selectedCards });

    case "celtic":
      return buildPromptCeltic({ mode, subType, question, selectedCards });

    default:
      throw new Error("Prompt oluşturulamadı");

  }

}

/* =========================================================
   OPENAI HELPERS
========================================================= */

function buildOpenAIMessages(prompt) {

  return [
    {
      role: "system",
      content: DEFAULT_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: prompt,
    },
  ];

}

function buildOpenAIRequest(prompt) {

  return {
    model: OPENAI_MODEL,
    messages: buildOpenAIMessages(prompt),
    temperature: 0.85,
  };

}

function buildTimeoutPromise(ms) {

  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("GPT timeout")), ms)
  );

}

function extractCompletionText(completion) {

  return (completion?.choices?.[0]?.message?.content || "").trim();

}

async function generateInterpretation({ mode, subType, question, selectedCards }) {

  const prompt = buildPrompt({
    mode,
    subType,
    question,
    selectedCards,
  });

  const timeout = buildTimeoutPromise(OPENAI_TIMEOUT_MS);

  const completion = await Promise.race([
    openai.chat.completions.create(buildOpenAIRequest(prompt)),
    timeout,
  ]);

  return extractCompletionText(completion);

}


/* =========================================================
   SESSION MEMORY HELPERS
========================================================= */

function buildInMemorySession({
  uid,
  mode,
  subType,
  question,
  selectedCards,
  interpretationPromise,
  cost,
  createdAt,
}) {

  return {
    uid,
    mode,
    subType,
    question,
    selectedCards,
    revealed: [],
    interpretationPromise,
    cost,
    createdAt,
    processing: false,
    status: "active",
  };

}

/* =========================================================
   REVEAL FLOW HELPERS
========================================================= */

function ensureSessionOwnership(session, uid) {

  if (session.uid !== uid) {
    throw new Error("Yetkisiz");
  }

}

function ensureSessionStateAvailable(session) {

  if (session.status === "completed") {
    throw new Error("Session tamamlandı");
  }

  if (session.status === "expired") {
    throw new Error("Session süresi doldu");
  }

}

async function ensureSessionNotExpired(sessionId, session) {

  if (isExpired(session)) {

    await markExpired(sessionId);

    removeSessionFromMemory(sessionId);

    throw new Error("Session süresi doldu");

  }

}

async function ensureRevealNotProcessing(sessionId, session) {

  const docCheck = await getSessionDoc(sessionId);

  if (session.processing || docCheck?.processing) {
    throw new Error("Reveal zaten işleniyor");
  }

}

function getNextRevealIndex(session) {
  return session.revealed.length;
}

function ensureCardsRemainToReveal(session, nextIndex) {

  if (nextIndex >= session.selectedCards.length) {
    throw new Error("Tüm kartlar açıldı");
  }

}

async function appendRevealedCard(sessionId, session, cardId) {

  session.revealed.push(cardId);

  await updateSessionDoc(sessionId, {
    revealed: session.revealed,
  });

}

function isRevealComplete(session) {

  return session.revealed.length === session.selectedCards.length;

}

/* =========================================================
   PUBLIC START
========================================================= */

export async function startTarot(uid, { mode, subType, question, coinPrice }) {

  validateStartInput({
    uid,
    mode,
    subType,
    question,
    coinPrice
  });

  const cardCount = resolveCardCount(mode);

  const selectedCards = pickCards(cardCount);

  const sessionId = await ensureUniqueSessionId();

  const createdAt = Date.now();

  await createSessionDoc(
    sessionId,
    buildCreateSessionPayload({
      uid,
      mode,
      subType,
      question,
      selectedCards,
      coinPrice,
      createdAt,
    })
  );

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

  putSessionInMemory(
    sessionId,
    buildInMemorySession({
      uid,
      mode,
      subType,
      question,
      selectedCards,
      interpretationPromise,
      cost: coinPrice,
      createdAt,
    })
  );

  return {
    sessionId,
    cardCount,
  };

}

/* =========================================================
   PUBLIC REVEAL
========================================================= */

export async function revealTarot(uid, { sessionId }) {

  let session = getSessionFromMemory(sessionId);

  if (!session) {

    session = await hydrateSessionFromDoc(sessionId);

    if (!session) {
      throw new Error("Session yok");
    }

    putSessionInMemory(sessionId, session);

  }

  ensureSessionOwnership(session, uid);

  ensureSessionStateAvailable(session);

  await ensureSessionNotExpired(sessionId, session);

  await ensureRevealNotProcessing(sessionId, session);

  session.processing = true;

  await lockSessionProcessing(sessionId);

  try {

    const nextIndex = getNextRevealIndex(session);

    ensureCardsRemainToReveal(session, nextIndex);

    const cardId = session.selectedCards[nextIndex];

    await appendRevealedCard(sessionId, session, cardId);

    const picked = toPicked(session.selectedCards, session.revealed.length);

    if (isRevealComplete(session)) {

      let interpretation = await readStoredInterpretation(sessionId);

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
          });

        } catch (err) {

          console.error("GPT FALLBACK ERROR:", err);

          interpretation = null;

        }

        if (interpretation) {

          await persistInterpretationIfAny(sessionId, interpretation);

        }

      }

      if (!interpretation) {

        await markExpired(sessionId);

        removeSessionFromMemory(sessionId);

        throw new Error("Yorum üretilemedi");

      }

      const remainingCoin = await decreaseCoin(
        uid,
        session.cost,
        "TAROT",
        { sessionId, mode: session.mode }
      );

      await markCompleted(sessionId, {
        remainingCoin,
      });

      removeSessionFromMemory(sessionId);

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

    const s = getSessionFromMemory(sessionId);

    if (s) s.processing = false;

    try {
      await unlockSessionProcessing(sessionId);
    } catch (_) {}

  }

}


/* =========================================================
   OPTIONAL META EXPORTS
========================================================= */

export function getTarotModeMeta(mode, subType = null) {

  const cardCount = resolveCardCount(mode);

  const spreadDescription = resolveSpreadDescription(mode, subType);

  const promptVariant = resolvePromptVariantKey(mode, subType);

  return {
    mode,
    subType,
    cardCount,
    spreadDescription,
    promptVariant,
  };

}

export async function getTarotSessionDebug(sessionId) {

  const memory = getSessionFromMemory(sessionId);

  const doc = await getSessionDoc(sessionId);

  return {

    sessionId,

    inMemory: memory
      ? {
          uid: memory.uid,
          mode: memory.mode,
          subType: memory.subType,
          question: memory.question,
          selectedCards: memory.selectedCards,
          revealed: memory.revealed,
          cost: memory.cost,
          createdAt: memory.createdAt,
          processing: memory.processing,
          status: memory.status,
          hasInterpretationPromise: !!memory.interpretationPromise,
        }
      : null,

    firestore: doc || null,

  };

}


/* =========================================================
   OPTIONAL PROMPT PREVIEW EXPORT
========================================================= */

export function previewTarotPrompt({ mode, subType, question, selectedCards }) {

  const expectedCount = resolveCardCount(mode);

  validateSelectedCards(selectedCards, expectedCount);

  return buildPrompt({
    mode,
    subType,
    question,
    selectedCards,
  });

}

