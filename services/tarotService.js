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

function isExpired(session) {
  return Date.now() - session.createdAt > SESSION_TTL;
}

function sessionRef(uid, sessionId) {
  return db
    .collection("users")
    .doc(uid)
    .collection("history")
    .doc(sessionId);
}

async function existsSessionDoc(uid, sessionId) {
  const snap = await sessionRef(uid, sessionId).get();
  return snap.exists;
}

async function createSessionDoc(uid, sessionId, data) {
  await sessionRef(uid, sessionId).set(data, { merge: false });
}

async function getSessionDoc(uid, sessionId) {
  const snap = await sessionRef(uid, sessionId).get();
  if (!snap.exists) return null;
  return snap.data();
}

async function updateSessionDoc(uid, sessionId, patch) {
  if (!(await existsSessionDoc(uid, sessionId))) return;
  await sessionRef(uid, sessionId).set(patch, { merge: true });
}

async function markCompleted(uid, sessionId, patch = {}) {
  await updateSessionDoc(uid, sessionId, {
    status: "completed",
    completedAt: Date.now(),
    completedAtServer: admin.firestore.FieldValue.serverTimestamp(),
    ...patch,
  });
}

async function markExpired(uid, sessionId) {
  await updateSessionDoc(uid, sessionId, {
    status: "expired",
    expiredAt: Date.now(),
    expiredAtServer: admin.firestore.FieldValue.serverTimestamp(),
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

function resolveSpreadDescription(mode, subType) {

  if (mode === "one") {
    return "Tek kart soru cevabı";
  }

  if (mode === "two") {
    return "İki kart detaylı soru cevabı";
  }

  if (mode === "three") {
    return "Geçmiş - Şimdi - Gelecek";
  }

  if (
    mode === "five" &&
    subType === "general"
  ) {
    return "Detaylı genel rehberlik";
  }

  if (
    mode === "five" &&
    subType === "relationship"
  ) {
    return "Aşk ve ilişki analizi";
  }

  if (
    mode === "five" &&
    subType === "spiritual"
  ) {
    return "Ruhsal gelişim açılımı";
  }

  if (mode === "celtic") {
    return "Kelt Haçı kapsamlı kader analizi";
  }

  return "Tarot açılımı";
}

function toPicked(selectedCards, revealedCount) {
  return (selectedCards || []).slice(0, revealedCount).map((id) => {
    const card = getTarotById(id);
    if (!card) throw new Error(`Kart bulunamadı: ${id}`);
    return { id, image: card.image };
  });
}

/* =========================
   PROMPT
========================= */

function buildPrompt({ mode, subType, question, selectedCards, user }) {

  const spreadDescription =
    resolveSpreadDescription(
      mode,
      subType
    ) || "Tarot açılımı";

  const personalInfo = `
Kullanıcı Bilgileri:
İsim: ${user?.name || ""}
Burç: ${user?.zodiac || ""}
Cinsiyet: ${user?.gender || ""}

Kişiselleştirme Kuralları:
- Kullanıcının ismi varsa yorum içinde doğal şekilde en az bir kez hitap et.
- Burç bilgisini varsa sezgisel alt ton olarak kullan ama burç yorumu yaptığını belli etme.
- Astroloji analizi gibi ayrı bölüm açma.
- Cinsiyet bilgisini yalnızca hitap tonunu yumuşatmak için kullan, doğrudan cinsiyet vurgusu yapma.
`.trim();

  if (mode === "one") {

    return `
Sen güçlü sezgilere sahip deneyimli, mistik bir tarot rehberisin.

Bu açılım tek karttır ve kartın mesajı kullanıcının şu anda duyması gereken en önemli farkındalığı temsil eder, kart sorusunun net cevabını verir.

Açılım Türü: ${spreadDescription}
${personalInfo}

Kart ID’leri: ${(selectedCards || []).join(", ")}
Alt kategori: ${subType || "Genel"}
Kullanıcının Sorusu: ${question || "Belirtilmedi"}

YAZIM KURALLARI:
- 220-250 kelime yaz.
- Kartın temel mesajını açıkla.
- Kart ID’si veya kartın nasıl analiz edildiği gibi bilgilerden kesinlikle bahsetme.
- Sorduğu sorunun cevabını seçilen kart üzerinden yorumla ve cevapla.
- Ruhsal, psikolojik ve pratik etkileri birlikte yorumla.
- Burç bilgisini varsa sezgisel alt ton olarak kullan ama astroloji analizi gibi ayrı bölüm açma.
- Son bölümde güçlü bir rehberlik mesajı ver.
- Yorum doğrudan başlasın.
`.trim();
  }

  if (mode === "two") {

    return `
Sen ikili enerji çatışmalarını ve ilişkisel dinamikleri güçlü sezgilerle okuyabilen deneyimli ve mistik bir tarot ustasısın.

Bu iki kartlık açılımda kartlar birbirini tamamlayan veya zorlayan enerjileri temsil eder. Kullanıcı seçilen bu iki kart ile sorduğu soruya rehberlik edilmesini ister.

Açılım Türü: ${spreadDescription}
${personalInfo}

Kart ID’leri: ${(selectedCards || []).join(", ")}
Alt kategori: ${subType || "Genel"}
Kullanıcının Sorusu: ${question || "Belirtilmedi"}

YAZIM KURALLARI:
- Minimum 350, maksimum 450 kelime yaz.
- Kart ID’si veya kartın nasıl analiz edildiği gibi bilgilerden kesinlikle bahsetme.
- İlk kart mevcut enerjiyi açıklar.
- İkinci kart karşıt veya gizli enerjiyi açıklar.
- Sorduğu sorunun cevabını seçilen kartlar üzerinden yorumla.
- Kartlar arası enerji çatışmasını, duygusal ve psikolojik etkileri birlikte ele al.
- Burç bilgisini varsa duygusal tonu zenginleştirmek için kullan ama belli etme.
- Yorum doğrudan başlasın.
`.trim();
  }

  if (mode === "three") {

    return `
Sen zaman çizgisi enerjilerini yorumlayan deneyimli ve mistik bir tarot rehberisin.

Bu açılım geçmiş, şimdi ve gelecek akışını gösterir.

Açılım Türü: ${spreadDescription}
${personalInfo}

Kart ID’leri: ${(selectedCards || []).join(", ")}
Alt kategori: ${subType || "Genel"}
Kullanıcının Sorusu: ${question || "Belirtilmedi"}

YAZIM KURALLARI:
- Minimum 550, maksimum 650 kelime yaz.
- Kart ID’si veya kartın nasıl analiz edildiği gibi bilgilerden kesinlikle bahsetme.
- İlk kart geçmiş etkileri anlatır.
- İkinci kart mevcut enerjiyi anlatır.
- Üçüncü kart geleceğe açılan yönü açıklar.
- Kartlar arası zaman köprüsünü kur.
- Burç bilgisini varsa kullanıcının karakter tonu ve enerji akışıyla ilişkilendir ama bunu açıkça söyleme.
- Son olarak rehberlik edici bir sonuç bölümü yaz.
- Yorum doğrudan başlasın.
`.trim();
  }

  if (mode === "five" && subType === "general") {

    return `
Sen hayatın genel akışını, fırsatları ve blokajları okuyabilen güçlü ve mistik bir tarot danışmanısın.

Bu açılım genel rehberlik içindir.

Açılım Türü: ${spreadDescription}
${personalInfo}

Kart ID’leri: ${(selectedCards || []).join(", ")}
Alt kategori: ${subType || "Genel"}
Kullanıcının Sorusu: ${question || "Belirtilmedi"}

YAZIM KURALLARI:
- Minimum 950, maksimum 1200 kelime yaz.
- Kart ID’si veya kartın nasıl analiz edildiği gibi bilgilerden kesinlikle bahsetme.
- Her kartı ayrı analiz et.
- Fırsatlar ve blokajları açıkla.
- Maddi, duygusal ve ruhsal etkileri değerlendir.
- Burç bilgisini varsa yorumun genel enerji tonuna yedir ama açıkça belli etme.
- Son bölümde net rehberlik ver.
- Yorum doğrudan başlasın.
`.trim();
  }

  if (mode === "five" && subType === "relationship") {

    return `
Sen ilişkisel enerji analizinde uzman mistik bir tarot ustasısın.

Bu açılım ilişki dinamiklerini analiz eder.

Açılım Türü: ${spreadDescription}
${personalInfo}

Kart ID’leri: ${(selectedCards || []).join(", ")}
Alt kategori: ${subType || "İlişki"}
Kullanıcının Sorusu: ${question || "Belirtilmedi"}

YAZIM KURALLARI:
- Minimum 950, maksimum 1200 kelime yaz.
- Kart ID’si veya kartın nasıl analiz edildiği gibi bilgilerden kesinlikle bahsetme.
- Kullanıcının duygusal durumunu analiz et.
- Karşı tarafın enerjisini yorumla.
- İlişki içindeki blokajları ve bağları açıkla.
- Geleceğe dair gerçekçi yönelim ver.
- Burç bilgisini varsa ilişki dinamiğinin duygusal tonu ile bağlantılandır ama bunu açıkça söyleme.
- Yorum doğrudan başlasın.
`.trim();
  }

  if (mode === "five" && subType === "spiritual") {

    return `
Sen ruhsal gelişim ve kader derslerini yorumlayan mistik bir tarot rehberisin.

Bu açılım ruhsal farkındalık içindir.

Açılım Türü: ${spreadDescription}
${personalInfo}

Kart ID’leri: ${(selectedCards || []).join(", ")}
Alt kategori: ${subType || "Ruhsal"}
Kullanıcının Sorusu: ${question || "Belirtilmedi"}

YAZIM KURALLARI:
- Minimum 950, maksimum 1200 kelime yaz.
- Kart ID’si veya kartın nasıl analiz edildiği gibi bilgilerden kesinlikle bahsetme.
- Ruhsal dersleri yorumla.
- Bırakılması gereken enerjileri açıkla.
- İçsel dönüşüm sürecini anlat.
- Kullanıcıya ruhsal rehberlik ver.
- Burç bilgisini varsa ruhsal eğilimle bağ kurmak için kullan ama bunu açıkça söyleme.
- Yorum doğrudan başlasın.
`.trim();
  }

  if (mode === "celtic") {

    return `
Sen kader analizinde uzman 30 yıllık deneyimli ve mistik bir tarot ustasısın.

Bu açılım Kelt Haçı’dır ve derin kader analizi gerektirir.

Açılım Türü: ${spreadDescription}
${personalInfo}

Kart ID’leri: ${(selectedCards || []).join(", ")}
Alt kategori: ${subType || "Genel"}
Kullanıcının Sorusu: ${question || "Belirtilmedi"}

ZORUNLU KURALLAR:
- Minimum 1700, maksimum 1900 kelime yaz.
- En az 10 paragraf oluştur.
- Her kartı bulunduğu pozisyona göre analiz et.
- Bilinçaltı etkileri açıkla.
- Karmik bağları değerlendir.
- İçsel çatışmaları analiz et.
- Dışsal faktörleri analiz et.
- Kader planı ve ruhsal dersleri detaylandır.
- Kartlar arası enerji akışını mutlaka açıkla.
- Maddi, duygusal, ruhsal ve zihinsel alanları ayrı ayrı ele al.
- Geleceğe dair güçlü ama gerçekçi öngörüler yap.
- Burç bilgisini varsa kullanıcının kader yolu ve kişisel eğilimlerine sezgisel alt ton olarak kat ama bunu açıkça söyleme.
- Sonunda güçlü bir kader rehberliği mesajı ver.

Analiz sürecini anlatma.
Teknik açıklama yapma.
Listeleme yapma.
Yorum doğrudan başlasın.
`.trim();
  }

  return `
Sen deneyimli ve sezgisel bir tarot rehberisin.

Açılım Türü: ${spreadDescription}
${personalInfo}

Kart ID’leri: ${(selectedCards || []).join(", ")}
Alt kategori: ${subType || "Genel"}
Kullanıcının Sorusu: ${question || "Belirtilmedi"}

- Her kart için ayrı paragraf yaz.
- Minimum 800 kelime olsun.
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
   GPT (timeout eklendi)
========================= */

async function generateInterpretation({ mode, subType, question, selectedCards, user }) {

  const prompt = buildPrompt({ mode, subType, question, selectedCards, user });

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("GPT timeout")), 45000)
  );

  const completion = await Promise.race([
    openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "Sen güçlü ve sezgisel bir tarot ustasısın." },
        { role: "user", content: prompt },
      ],
      temperature: 0.85,
    }),
    timeout
  ]);

  return (completion?.choices?.[0]?.message?.content || "").trim();
}

/* =========================
   START
========================= */

export async function startTarot(uid, { mode, subType, question, coinPrice, user }) {

  if (!uid) throw new Error("UID gerekli");
  if (!coinPrice) throw new Error("Coin price eksik");

  const cardCount = resolveCardCount(mode);
  const selectedCards = pickCards(cardCount);

  let sessionId = crypto.randomUUID();

  const createdAt = Date.now();

  const interpretationPromise = generateInterpretation({
    mode,
    subType,
    question,
    selectedCards,
    user,
  })
    .then(async (text) => {

      const t = (text || "").trim();

      if (t) {
        await updateSessionDoc(uid, sessionId, {
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
    user,
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

  let session = sessionStore.get(sessionId);

  if (!session) {

    const doc = await getSessionDoc(uid, sessionId);
    if (!doc) throw new Error("Session yok");

    session = {
      uid: doc.uid,
      mode: doc.mode,
      subType: doc.subType || null,
      question: doc.question || null,
      selectedCards: doc.selectedCards || [],
      user: doc.user || null,
      revealed: doc.revealed || [],
      interpretationPromise: null,
      cost: doc.cost,
      createdAt: doc.createdAt,
      processing: !!doc.processing,
      status: doc.status || "active",
    };

    sessionStore.set(sessionId, session);
  }

  if (session.uid !== uid) throw new Error("Yetkisiz");

  if (session.status === "completed") throw new Error("Session tamamlandı");
  if (session.status === "expired") throw new Error("Session süresi doldu");

  if (isExpired(session)) {
    await markExpired(uid, sessionId);
    sessionStore.delete(sessionId);
    throw new Error("Session süresi doldu");
  }

  const docCheck = await getSessionDoc(uid, sessionId);

  if (session.processing || docCheck?.processing) {
    throw new Error("Reveal zaten işleniyor");
  }

  session.processing = true;

  await updateSessionDoc(uid, sessionId, { processing: true });

  try {

    const nextIndex = session.revealed.length;

    if (nextIndex >= session.selectedCards.length)
      throw new Error("Tüm kartlar açıldı");

    const cardId = session.selectedCards[nextIndex];

    session.revealed.push(cardId);

    await updateSessionDoc(uid, sessionId, {
      revealed: session.revealed,
    });

    const picked = toPicked(session.selectedCards, session.revealed.length);

    if (session.revealed.length === session.selectedCards.length) {

      let interpretation = null;

      const docNow = await getSessionDoc(uid, sessionId);

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
            user: session.user,
          });

        } catch (err) {

          console.error("GPT FALLBACK ERROR:", err);
          interpretation = null;
        }

        if (interpretation) {

          await updateSessionDoc(uid, sessionId, {
            interpretation: interpretation.trim(),
            interpretationReadyAt: Date.now(),
          });
        }
      }

      if (!interpretation) {

        await markExpired(uid, sessionId);
        sessionStore.delete(sessionId);
        throw new Error("Yorum üretilemedi");
      }

      const remainingCoin = await decreaseCoin(
        uid,
        session.cost,
        "TAROT",
        { sessionId, mode: session.mode }
      );

      if (!(await existsSessionDoc(uid, sessionId))) {
        await createSessionDoc(uid, sessionId, {
          uid,
          type: "tarot",
          sessionId,
          mode: session.mode,
          subType: session.subType || null,
          tarotType:
            session.subType ||
            resolveSpreadDescription(
              session.mode,
              session.subType
            ) ||
            session.mode,
          question: session.question || "",
          selectedCards: session.selectedCards,
          user: session.user || null,
          revealed: session.revealed,
          cards: picked,
          cardImages: picked.map((c) => c.image),
          cost: session.cost,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAtMs: Date.now(),
          createdAtServer: admin.firestore.FieldValue.serverTimestamp(),
          status: "completed",
          interpretation,
          interpretationReadyAt: Date.now(),
          interpretationReadyAtServer: admin.firestore.FieldValue.serverTimestamp(),
          remainingCoin,
          processing: false,
        });
      }

      await markCompleted(uid, sessionId, {
        remainingCoin,
        cards: picked,
        interpretation,
      });

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

    try {
      await updateSessionDoc(uid, sessionId, { processing: false });
    } catch (_) {}
  }
}