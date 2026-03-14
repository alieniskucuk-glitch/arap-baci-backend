import crypto from "crypto";
import openai from "../config/openai.js";
import { decreaseCoin } from "../utils/coinManager.js";
import { getTarotById } from "../utils/tarotDeck.js";
import { db } from "../config/firebase.js";

/* =========================
   MEMORY SESSION STORE
========================= */

const sessionStore = new Map();
const SESSION_TTL = 1000 * 60 * 10; // 10 dakika

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
  if (mode === "one") return "Tek kart ilahi mesaj";
  if (mode === "two") return "Durum ve karşıt enerji";
  if (mode === "three") return "Geçmiş - Şimdi - Gelecek";
  if (mode === "celtic") return "Kelt Haçı kapsamlı kader analizi";

  if (mode === "five" && subType === "general") {
    return "Detaylı rehberlik açılımı";
  }

  if (mode === "five" && subType === "relationship") {
    return "İlişki odaklı detaylı rehberlik açılımı";
  }

  if (mode === "five" && subType === "spiritual") {
    return "Ruhsal farkındalık açılımı";
  }

  return "Tarot açılımı";
}

function getCardLabel(card) {
  return (
    card?.name ||
    card?.title ||
    card?.turkishName ||
    card?.label ||
    card?.cardName ||
    "Bilinmeyen Kart"
  );
}

function buildCardIdentityLines(selectedCards) {
  return (selectedCards || [])
    .map((id, index) => {
      const card = getTarotById(id);
      if (!card) throw new Error(`Kart bulunamadı: ${id}`);
      return `${index + 1}. kart: ${getCardLabel(card)}`;
    })
    .join("\n");
}

function buildCardNameCsv(selectedCards) {
  return (selectedCards || [])
    .map((id) => {
      const card = getTarotById(id);
      if (!card) throw new Error(`Kart bulunamadı: ${id}`);
      return getCardLabel(card);
    })
    .join(", ");
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

  return data?.name || null;
}

async function saveTarotHistory({
  uid,
  userName,
  mode,
  subType,
  question,
  selectedCards,
  interpretation,
}) {
  await db.collection("tarotHistory").add({
    uid,
    userName: userName || null,
    mode,
    subType: subType || null,
    question: question || null,
    selectedCards: selectedCards || [],
    interpretation: interpretation || "",
    createdAt: Date.now(),
  });
}

/* =========================================================
   POSITION HELPERS
========================================================= */

function resolveOneCardPositionGuide() {
  return [
    "Bu tek kart kullanıcının şu anda en çok duyması gereken ana mesajı temsil eder. Sorduğu sorunun net cevabını verir.",
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

function buildPromptContext({ mode, subType, question, selectedCards, userName }) {
  const spreadDescription = resolveSpreadDescription(mode, subType) || "Tarot açılımı";
  const questionText = question || "Belirtilmedi";
  const cardIds = (selectedCards || []).join(", ");
  const cardIdentityLines = buildCardIdentityLines(selectedCards);
  const cardNameCsv = buildCardNameCsv(selectedCards);
  const positionGuide = resolvePositionGuide(mode, subType);

  const nameLine = userName
    ? `Kullanıcının adı: ${userName}`
    : "Kullanıcının adı belirtilmedi.";

  return {
    spreadDescription,
    questionText,
    cardIds,
    cardIdentityLines,
    cardNameCsv,
    positionGuide,
    nameLine,
  };
}

function buildPromptOne({ mode, subType, question, selectedCards, userName }) {
  const ctx = buildPromptContext({ mode, subType, question, selectedCards, userName });

  return `
Sen güçlü sezgilere sahip deneyimli, mistik bir tarot rehberisin.

Bu açılım tek karttır ve kartın mesajı kullanıcının şu anda duyması gereken en önemli farkındalığı temsil eder, kart sorusunun net cevabını verir.

Açılım Türü: ${ctx.spreadDescription}
${ctx.nameLine}
Kart ID'leri: ${ctx.cardIds}
Kullanıcının Sorusu: ${ctx.questionText}

Kart Bilgileri:
${ctx.cardIdentityLines}

Pozisyon Rehberi:
${ctx.positionGuide}

YAZIM KURALLARI
- Minimum 200, maksimum 250 kelime yaz
- kartın temel mesajını açıkla
- kart Id si veya kartın nasıl analiz edildiği gibi bilgilerden kesinlikle bahsetme.
- Sorduğu sorunun cevabını seçilen kart üzerinden yorumla ve cevapla
- Ruhsal, psikolojik ve pratik etkileri birlikte yorumla
- Kullanıcının içsel durumunu sezgisel şekilde anlat
- Son bölümde güçlü bir rehberlik mesajı ver
- Eğer kullanıcının adı verilmişse yorum içinde en az bir kez adı ile hitap et, yoksa genel hitap kullan

Yorum doğrudan başlasın.
`.trim();
}

function buildPromptTwo({ mode, subType, question, selectedCards, userName }) {
  const ctx = buildPromptContext({ mode, subType, question, selectedCards, userName });

  return `
Sen ikili enerji çatışmalarını ve ilişkisel dinamikleri güçlü sezgilerle okuyabilen deneyimli ve mistik bir tarot ustasısın.

Bu iki kartlık açılımda kartlar birbirini tamamlayan veya zorlayan enerjileri temsil eder. kullanıcı seçilen bu iki kart ile sorduğu soruya rehberlik edilmesini ister.

Açılım Türü: ${ctx.spreadDescription}
${ctx.nameLine}
Kart ID'leri: ${ctx.cardIds}
Kullanıcının Sorusu: ${ctx.questionText}

Kart Bilgileri:
${ctx.cardIdentityLines}

Pozisyon Rehberi:
${ctx.positionGuide}

YAZIM KURALLARI
- Minimum 350, maksimum 450 kelime yaz
- kart Id si veya kartın nasıl analiz edildiği gibi bilgilerden kesinlikle bahsetme.
- İlk kart mevcut enerjiyi açıklar
- İkinci kart karşıt veya gizli enerjiyi açıklar
- Sorduğu sorunun cevabını seçilen kartlar üzerinden, Kartlar arası enerji çatışmasını, Duygusal ve psikolojik etkileri birlikte ele alarak yorumla ve cevapla
- Eğer kullanıcının adı verilmişse yorum içinde en az bir kez adı ile hitap et, yoksa genel hitap kullan

Yorum doğrudan başlasın.
`.trim();
}

function buildPromptThree({ mode, subType, question, selectedCards, userName }) {
  const ctx = buildPromptContext({ mode, subType, question, selectedCards, userName });

  return `
Sen zaman çizgisi enerjilerini yorumlayan deneyimli ve mistik bir tarot rehberisin.

Bu açılım geçmiş, şimdi ve gelecek akışını gösterir.

Açılım Türü: ${ctx.spreadDescription}
${ctx.nameLine}
Kart ID'leri: ${ctx.cardIds}
Kullanıcının Sorusu: ${ctx.questionText}

Kart Bilgileri:
${ctx.cardIdentityLines}

Pozisyon Rehberi:
${ctx.positionGuide}

YAZIM KURALLARI
- Minimum 650, maksimum 720 kelime yaz
- kart Id si veya kartın nasıl analiz edildiği gibi bilgilerden kesinlikle bahsetme.
- İlk kart geçmiş etkileri anlatır
- İkinci kart mevcut enerjiyi anlatır
- Üçüncü kart geleceğe açılan yönü açıklar
- Kartlar arası zaman köprüsünü kur
- Son olarak rehberlik edici bir sonuç bölümü yaz.
- Eğer kullanıcının adı verilmişse yorum içinde en az bir kez adı ile hitap et, yoksa genel hitap kullan

Yorum doğrudan başlasın.
`.trim();
}

function buildPromptFiveGeneral({ mode, subType, question, selectedCards, userName }) {
  const ctx = buildPromptContext({ mode, subType, question, selectedCards, userName });

  return `
Sen hayatın genel akışını, fırsatları ve blokajları okuyabilen güçlü ve mistik bir tarot danışmanısın.

Bu açılım genel rehberlik içindir.

Açılım Türü: ${ctx.spreadDescription}
${ctx.nameLine}
Kart ID'leri: ${ctx.cardIds}
Kullanıcının Sorusu: ${ctx.questionText}

Kart Bilgileri:
${ctx.cardIdentityLines}

Pozisyon Rehberi:
${ctx.positionGuide}

YAZIM KURALLARI
- Minimum 950, maksimum 1100 kelime yaz
- kart Id si veya kartın nasıl analiz edildiği gibi bilgilerden kesinlikle bahsetme.
- Her kartı ayrı analiz et
- Fırsatlar ve blokajları açıkla
- Maddi, duygusal ve ruhsal etkileri değerlendir
- Son bölümde net rehberlik ver
- Eğer kullanıcının adı verilmişse yorum içinde en az bir kez adı ile hitap et, yoksa genel hitap kullan

Yorum doğrudan başlasın.
`.trim();
}

function buildPromptFiveRelationship({ mode, subType, question, selectedCards, userName }) {
  const ctx = buildPromptContext({ mode, subType, question, selectedCards, userName });

  return `
Sen ilişkisel enerji analizinde uzman mistik bir tarot ustasısın.

Bu açılım ilişki dinamiklerini analiz eder.

Açılım Türü: ${ctx.spreadDescription}
${ctx.nameLine}
Kart ID'leri: ${ctx.cardIds}
Kullanıcının Sorusu: ${ctx.questionText}

Kart Bilgileri:
${ctx.cardIdentityLines}

Pozisyon Rehberi:
${ctx.positionGuide}

YAZIM KURALLARI
- Minimum 950, maksimum 1100 kelime yaz
- kart Id si veya kartın nasıl analiz edildiği gibi bilgilerden kesinlikle bahsetme.
- Kullanıcının duygusal durumunu analiz et
- Karşı tarafın enerjisini yorumla
- İlişki içindeki blokajları ve bağları açıkla
- Geleceğe dair gerçekçi yönelim ver
- Eğer kullanıcının adı verilmişse yorum içinde en az bir kez adı ile hitap et, yoksa genel hitap kullan

Yorum doğrudan başlasın.
`.trim();
}

function buildPromptFiveSpiritual({ mode, subType, question, selectedCards, userName }) {
  const ctx = buildPromptContext({ mode, subType, question, selectedCards, userName });

  return `
Sen ruhsal gelişim ve kader derslerini yorumlayan mistik bir tarot rehberisin.

Bu açılım ruhsal farkındalık içindir.

Açılım Türü: ${ctx.spreadDescription}
${ctx.nameLine}
Kart ID'leri: ${ctx.cardIds}
Kullanıcının Sorusu: ${ctx.questionText}

Kart Bilgileri:
${ctx.cardIdentityLines}

Pozisyon Rehberi:
${ctx.positionGuide}

YAZIM KURALLARI
- Minimum 950, maksimum 1100 kelime yaz
- kart Id si veya kartın nasıl analiz edildiği gibi bilgilerden kesinlikle bahsetme.
- Ruhsal dersleri yorumla
- Bırakılması gereken enerjileri açıkla
- İçsel dönüşüm sürecini anlat
- Kullanıcıya ruhsal rehberlik ver
- Eğer kullanıcının adı verilmişse yorum içinde en az bir kez adı ile hitap et, yoksa genel hitap kullan

Yorum doğrudan başlasın.
`.trim();
}

function buildPromptCeltic({ mode, subType, question, selectedCards, userName }) {
  const ctx = buildPromptContext({ mode, subType, question, selectedCards, userName });

  return `
Sen kader analizinde uzman 30 yıllık deneyimli ve mistik bir tarot ustasısın.

Bu açılım Kelt Haçı'dır ve derin kader analizi gerektirir.

Açılım Türü: ${ctx.spreadDescription}
${ctx.nameLine}
Kart ID'leri: ${ctx.cardIds}
Kullanıcının Sorusu: ${ctx.questionText}

Kart Bilgileri:
${ctx.cardIdentityLines}

Pozisyon Rehberi:
${ctx.positionGuide}

YAZIM KURALLARI
- Minimum 1500, maksimum 1700 kelime yaz
- En az 10 paragraf oluştur
- Her kartı bulunduğu pozisyona göre analiz et
- Karmik bağları ve bilinçaltı etkileri açıkla
- Kartlar arası enerji akışını yorumla
- Sonunda güçlü bir kader rehberliği mesajı ver
- Eğer kullanıcının adı verilmişse yorum içinde en az bir kez adı ile hitap et, yoksa genel hitap kullan

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
  userName,
}) {
  const prompt = buildPromptRouter({
    mode,
    subType,
    question,
    selectedCards,
    userName,
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
          content: "Sen güçlü sezgilere sahip deneyimli bir tarot ustasısın.",
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

export async function startTarot(uid, { mode, subType, question, coinPrice }) {
  if (!uid) throw new Error("UID gerekli");
  if (!coinPrice) throw new Error("Coin price eksik");

  const cardCount = resolveCardCount(mode);
  const selectedCards = pickCards(cardCount);
  const userName = await getUserName(uid);

  const sessionId = crypto.randomUUID();
  const createdAt = Date.now();

  const interpretationPromise = generateInterpretation({
    mode,
    subType,
    question,
    selectedCards,
    userName,
  })
    .then((text) => {
      const t = (text || "").trim();
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
    subType: subType || null,
    question: question || null,
    selectedCards,
    revealed: [],
    interpretationPromise,
    cost: coinPrice,
    createdAt,
    processing: false,
    status: "active",
    historySaved: false,
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

  if (!session) throw new Error("Session yok");
  if (session.uid !== uid) throw new Error("Yetkisiz");
  if (session.status === "completed") throw new Error("Session tamamlandı");
  if (session.status === "expired") throw new Error("Session süresi doldu");

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

    const picked = toPicked(session.selectedCards, session.revealed.length);

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
            userName: session.userName,
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
        { mode: session.mode }
      );

      if (!session.historySaved) {
        await saveTarotHistory({
          uid,
          userName: session.userName,
          mode: session.mode,
          subType: session.subType,
          question: session.question,
          selectedCards: session.selectedCards,
          interpretation,
        });

        session.historySaved = true;
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
    if (s) s.processing = false;
  }
}
