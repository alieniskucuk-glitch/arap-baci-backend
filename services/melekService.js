import crypto from "crypto";
import OpenAI from "openai";
import { MELEK_DECK } from "../utils/melekDeck.js";
import { PRICING } from "../utils/pricing.js";
import { decreaseCoin } from "../utils/coinManager.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const sessionStore = new Map();
const SESSION_TTL = 1000 * 60 * 10;

/* =========================
   UTIL
========================= */

function randomFromRange(min, max, exclude = new Set()) {
  const pool = MELEK_DECK.filter(
    (c) => c.id >= min && c.id <= max && !exclude.has(c.id)
  );

  if (!pool.length) throw new Error("Kart bulunamadı");

  return pool[Math.floor(Math.random() * pool.length)];
}

function getCardCount(mode) {
  if (!["standard", "deep", "zaman"].includes(mode)) {
    throw new Error("Geçersiz melek modu");
  }

  if (mode === "standard") return 1;
  if (mode === "deep") return 2;
  return 3;
}

function getMelekPrice(mode) {
  if (mode === "standard") return PRICING.MELEK.ONE_CARD;
  if (mode === "deep") return PRICING.MELEK.TWO_CARD;
  if (mode === "zaman") return PRICING.MELEK.THREE_CARD;
  throw new Error("Fiyat hesaplanamadı");
}

function isExpired(session) {
  return Date.now() - session.createdAt > SESSION_TTL;
}

/* =========================
   SEMBOL HARİTASI + MİSTİK YIL
   - Mevcut Melek / Kehanet akışından bağımsızdır
   - Hata verirse çalışan akışı etkilemez
========================= */

function normalizeInsightId(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function generateMelekInsights(
  interpretation
) {
  const cleanInterpretation =
    String(interpretation || "").trim();

  if (!cleanInterpretation) {
    return {
      symbols: [],
      themes: [],
      primaryTheme: null,
    };
  }

  try {
    const insightsRequest =
      openai.chat.completions.create({
        model: "gpt-4.1-mini",

        response_format: {
          type: "json_object",
        },

        messages: [
          {
            role: "system",

            content: `
Verilen melek kartı yorumundan
Kişisel Sembol Haritası ve
Benim Mistik Yılım için
yapılandırılmış veri çıkar.

SEMBOL KURALLARI:

- Yalnızca yorumda gerçekten sembolik anlam taşıyan işaret, nesne veya arketipleri çıkar.
- Sıradan kullanılan kelimeleri sembol olarak alma.
- Yorumda olmayan sembol uydurma.
- En fazla 6 sembol çıkar.
- Aynı sembolü birden fazla kez ekleme.
- name kısa ve Türkçe olsun.
- meaning sembolün bu melek yorumundaki anlamını tek kısa cümleyle anlatsın.

TEMA KURALLARI:

- themes yalnızca yorumun gerçekten baskın konularını içersin.
- En fazla 5 tema çıkar.
- Tema isimlerini kısa ve tekrar kullanılabilir biçimde yaz.
- Örnekler: Aşk, İlişki, Aile, Kariyer, Para, Değişim, Karar, Güven, Ruhsal Gelişim, İçsel Dönüşüm, Yeni Başlangıç.
- Aynı anlama gelen birden fazla tema üretme.
- primaryTheme themes içindeki en baskın tek tema olmalı.
- Tema yoksa themes boş dizi ve primaryTheme null olsun.

Açıklama yazma.
Markdown yazma.
Ek metin yazma.

SADECE şu JSON formatında cevap ver:

{
  "symbols": [
    {
      "name": "Işık",
      "meaning": "Netleşme ve rehberliği temsil ediyor."
    }
  ],
  "themes": [
    "Ruhsal Gelişim",
    "Karar"
  ],
  "primaryTheme": "Ruhsal Gelişim"
}
`.trim(),
          },

          {
            role: "user",

            content:
              `MELEK YORUMU:\n\n${cleanInterpretation}`,
          },
        ],

        temperature: 0.15,
      });

    const timeout =
      new Promise(
        (_, reject) => {
          setTimeout(
            () =>
              reject(
                new Error(
                  "Melek insights timeout"
                )
              ),
            10000
          );
        }
      );

    const completion =
      await Promise.race([
        insightsRequest,
        timeout,
      ]);

    const raw =
      String(
        completion
          ?.choices?.[0]
          ?.message?.content || ""
      )
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    if (!raw) {
      throw new Error(
        "Boş melek insight cevabı"
      );
    }

    const parsed =
      JSON.parse(raw);

    const symbolMap =
      new Map();

    if (
      Array.isArray(
        parsed.symbols
      )
    ) {
      for (
        const item
        of parsed.symbols
      ) {
        const name =
          typeof item?.name ===
          "string"
            ? item.name.trim()
            : "";

        if (!name) {
          continue;
        }

        const id =
          normalizeInsightId(name);

        if (
          !id ||
          symbolMap.has(id)
        ) {
          continue;
        }

        const meaning =
          typeof item?.meaning ===
          "string"
            ? item.meaning.trim()
            : "";

        symbolMap.set(
          id,
          {
            id,
            name,
            meaning,
          }
        );

        if (
          symbolMap.size >= 6
        ) {
          break;
        }
      }
    }

    const themeMap =
      new Map();

    if (
      Array.isArray(
        parsed.themes
      )
    ) {
      for (
        const item
        of parsed.themes
      ) {
        if (
          typeof item !==
          "string"
        ) {
          continue;
        }

        const theme =
          item.trim();

        if (!theme) {
          continue;
        }

        const key =
          theme.toLocaleLowerCase(
            "tr-TR"
          );

        if (
          themeMap.has(key)
        ) {
          continue;
        }

        themeMap.set(
          key,
          theme
        );

        if (
          themeMap.size >= 5
        ) {
          break;
        }
      }
    }

    const symbols =
      Array.from(
        symbolMap.values()
      );

    const themes =
      Array.from(
        themeMap.values()
      );

    const rawPrimaryTheme =
      typeof parsed.primaryTheme ===
      "string"
        ? parsed.primaryTheme.trim()
        : "";

    let primaryTheme =
      null;

    if (
      rawPrimaryTheme
    ) {
      const matchedTheme =
        themes.find(
          (theme) =>
            theme.toLocaleLowerCase(
              "tr-TR"
            ) ===
            rawPrimaryTheme.toLocaleLowerCase(
              "tr-TR"
            )
        );

      if (
        matchedTheme
      ) {
        primaryTheme =
          matchedTheme;
      }
    }

    return {
      symbols,
      themes,
      primaryTheme,
    };

  } catch (err) {
    console.error(
      "MELEK INSIGHTS ERROR:",
      err
    );

    return {
      symbols: [],
      themes: [],
      primaryTheme: null,
    };
  }
}

/* =========================
   START
========================= */

export async function startMelek(uid, body) {
  const { mode, question } = body;

  const cardCount = getCardCount(mode);

  const used = new Set();
  const cards = [];

  if (mode === "standard") {
    cards.push(
      randomFromRange(
        33,
        53,
        used
      )
    );
  }

  if (mode === "deep") {
    const c1 =
      randomFromRange(
        33,
        53,
        used
      );

    used.add(c1.id);

    const c2 =
      randomFromRange(
        0,
        32,
        used
      );

    cards.push(
      c1,
      c2
    );
  }

  if (mode === "zaman") {
    for (
      let i = 0;
      i < 3;
      i++
    ) {
      const c =
        randomFromRange(
          0,
          53,
          used
        );

      used.add(c.id);

      cards.push(c);
    }
  }

  const sessionId =
    crypto.randomUUID();

  const interpretationPromise =
    generateInterpretation(
      mode,
      question,
      cards,
      body.user
    ).catch(() => null);

  sessionStore.set(
    sessionId,
    {
      uid,
      mode,
      question:
        question || null,
      cards,
      revealed: [],
      interpretationPromise,
      createdAt:
        Date.now(),
    }
  );

  return {
    sessionId,
    cardCount,
  };
}

/* =========================
   REVEAL
========================= */

export async function revealMelek(
  uid,
  body
) {
  const {
    sessionId
  } = body;

  const session =
    sessionStore.get(
      sessionId
    );

  if (!session) {
    throw new Error(
      "Session bulunamadı"
    );
  }

  if (
    session.uid !== uid
  ) {
    throw new Error(
      "Yetkisiz erişim"
    );
  }

  if (
    isExpired(session)
  ) {
    sessionStore.delete(
      sessionId
    );

    throw new Error(
      "Session süresi doldu"
    );
  }

  const nextIndex =
    session.revealed.length;

  if (
    nextIndex >=
    session.cards.length
  ) {
    throw new Error(
      "Tüm kartlar açıldı"
    );
  }

  const card =
    session.cards[
      nextIndex
    ];

  session.revealed.push(
    card
  );

  const picked =
    session.revealed.map(
      (c) => ({
        title:
          c.title,

        image:
          c.image,
      })
    );

  if (
    session.revealed.length ===
    session.cards.length
  ) {
    const interpretation =
      await session
        .interpretationPromise;

    if (
      !interpretation
    ) {
      throw new Error(
        "Yorum üretilemedi"
      );
    }

    const price =
      getMelekPrice(
        session.mode
      );

    const remainingCoin =
      await decreaseCoin(
        uid,
        price,
        "MELEK",
        {
          sessionId
        }
      );

    let prediction =
      null;

    let checkAfterDays =
      null;

    try {
      const predictionData =
        await generateMelekPrediction(
          interpretation
        );

      prediction =
        predictionData
          ?.prediction ||
        null;

      checkAfterDays =
        predictionData
          ?.checkAfterDays ||
        null;

    } catch (
      predictionError
    ) {
      console.error(
        "MELEK PREDICTION ERROR:",
        predictionError
      );
    }

    let insights = {
      symbols: [],
      themes: [],
      primaryTheme: null,
    };

    try {
      insights =
        await generateMelekInsights(
          interpretation
        );

    } catch (
      insightsError
    ) {
      console.error(
        "MELEK INSIGHTS ERROR:",
        insightsError
      );
    }

    sessionStore.delete(
      sessionId
    );

    return {
      picked,

      interpretation,

      remainingCoin,

      prediction,

      checkAfterDays,

      symbols:
        insights.symbols,

      themes:
        insights.themes,

      primaryTheme:
        insights.primaryTheme,
    };
  }

  return {
    picked,
    interpretation: null,
    remainingCoin: null,
  };
}

/* =========================
   GPT
========================= */

async function generateInterpretation(
  mode,
  question,
  cards,
  user = {}
) {
  let prompt = "";

  /* =========================
     1 KART
  ========================= */

  if (
    mode === "standard"
  ) {
    prompt = `
Sen Arap Bacı uygulamasında
ilahi rehberlik sunan
güçlü ve sezgisel
bir melek kartı yorumcususun.

Bu açılım:

TEK KARTLIK
NET CEVAP
açılımıdır.

Açılan kart üzerinden kullanıcının sorusunu yanıtla.
KULLANICI:

İsim:
${user?.name || ""}

Burç:
${user?.zodiac || ""}

Cinsiyet:
${user?.gender || ""}

Burç etkisini kullan
ama belli etme.

Kart:

${cards[0].title}

Soru:

${question || "Genel rehberlik"}

Kurallar:

- ASLA “canım”, “güzelim”, “enerjini hissettim”, “mistik yolculuk”, “auran”, “okyanus gibi ruhun” gibi klişe ifadeler kullanma.
- Fal içinde kullanıcının adını doğal akışa uygun şekilde 1 veya 2 kez kullan. 
- Genel kişilik analizi yapma.
- Kullanıcıyı övme.
- Her yorum benzersiz olsun.
- Samimi ol ama Fazla değil, deneyimli falcı tonu kullan.
- kart numarasından asla bahsetme. 
- Teknik terimler kullanma
- Yoruma direkt başla
- Kartın ana mesajına odaklan
- Net cevap ver
- 300 ile 500 token arasında yaz.
- Kullanıcıyı memnun etmek için yorumu olumluya çevirme; ne görüyorsan onu dengeli ve dürüst yorumla. Olumsuz işaretleri yumuşatma, her falı umut veren bir sonuca bağlama.

`;
  }

  /* =========================
     2 KART
  ========================= */

  if (
    mode === "deep"
  ) {
    prompt = `
Sen Arap Bacı uygulamasında
derin rehberlik veren
bir melek yorumcususun.

Bu açılım:

2 KARTLIK
DETAYLI REHBERLİK
açılımıdır.

kullanıcının sorusunu iki kart üzerinden detaylı şekilde yanıtla.

KULLANICI:

İsim:
${user?.name || ""}

Burç:
${user?.zodiac || ""}

Cinsiyet:
${user?.gender || ""}

Burç etkisini kullan
ama yazma.

Soru:

${question || "Detaylı rehberlik"}

1. Kart:

${cards[0].title}

2. Kart:

${cards[1].title}

Kurallar:

- ASLA “canım”, “güzelim”, “enerjini hissettim”, “mistik yolculuk”, “auran”, “okyanus gibi ruhun” gibi klişe ifadeler kullanma.
- Fal içinde kullanıcının adını doğal akışa uygun şekilde 1 veya 2 kez kullan. 
- Genel kişilik analizi yapma.
- Kullanıcıyı övme.
- Her yorum benzersiz olsun.
- Samimi ol ama Fazla değil, deneyimli falcı tonu kullan.
- İlk kart ana enerjiyi anlatır
- İkinci kart çözüm sunar
- Kartları ayrı yorumla
- Sonunda birleşik ilahi mesaj ver
- Kart numarasından asla bahsetme. 
- Teknik terimler kulanma.
- 550 ile 750 token aralığında yaz.
- Kullanıcıyı memnun etmek için yorumu olumluya çevirme; ne görüyorsan onu dengeli ve dürüst yorumla. Olumsuz işaretleri yumuşatma, her falı umut veren bir sonuca bağlama.

`;
  }

  /* =========================
     ZAMAN
  ========================= */

  if (
    mode === "zaman"
  ) {
    prompt = `
Sen Arap Bacı uygulamasında
zaman akışı yorumlayan
bir melek rehberisin.

Bu açılım:

GEÇMİŞ
ŞİMDİ
GELECEK

açılımıdır.

KULLANICI:

İsim:
${user?.name || ""}

Burç:
${user?.zodiac || ""}

Cinsiyet:
${user?.gender || ""}

Burç adı yazma.

Geçmiş:

${cards[0].title}

Şimdi:

${cards[1].title}

Gelecek:

${cards[2].title}

Kurallar:
- ASLA “canım”, “güzelim”, “enerjini hissettim”, “mistik yolculuk”, “auran”, “okyanus gibi ruhun” gibi klişe ifadeler kullanma.
- Fal içinde kullanıcının adını doğal akışa uygun şekilde 1 veya 2 kez kullan. 
- Genel kişilik analizi yapma.
- Kullanıcıyı övme.
- Her yorum benzersiz olsun.
- Samimi ol ama Fazla değil, deneyimli falcı tonu kullan.
- Geçmiş enerjiyi anlat
- Şimdiki durumu yorumla
- Geleceği açıkla
- Zaman akışını bağla
- Ruhsal gelişimi vurgula
- Kart numarasından asla bahsetme.
- Teknik terimler kulanma.
- 800 ile 1100 token aralığında yaz.
- Kullanıcıyı memnun etmek için yorumu olumluya çevirme; ne görüyorsan onu dengeli ve dürüst yorumla. Olumsuz işaretleri yumuşatma, her falı umut veren bir sonuca bağlama.

`;
  }

  const completion =
    await openai.chat.completions.create({
      model:
        "gpt-4.1-mini",

      messages: [
        {
          role:
            "system",

          content:
            "Sen mistik ama net konuşan, güçlü bir melek kartı rehberisin.",
        },

        {
          role:
            "user",

          content:
            prompt,
        },
      ],

      temperature:
        0.85,
    });

  return completion
    .choices[0]
    .message
    .content
    .trim();
}

/* =========================
   KEHANET KASASI
   - Mevcut melek yorumunu değiştirmez
   - Ayrı yardımcı çağrıdır
========================= */

async function generateMelekPrediction(
  interpretation
) {
  const cleanInterpretation =
    String(
      interpretation || ""
    ).trim();

  if (
    !cleanInterpretation
  ) {
    return {
      prediction:
        null,

      checkAfterDays:
        null,
    };
  }

  const predictionRequest =
    openai.chat.completions.create({
      model:
        "gpt-4.1-mini",

      messages: [
        {
          role:
            "system",

          content: `
Verilen melek kartı yorumundan
Kehanet Kasası için
tek bir gelecek öngörüsü çıkar.

Kurallar:

- Melek yorumunda olmayan yeni bir olay uydurma.
- Yalnızca geleceğe yönelik en net ve sonradan kontrol edilebilir öngörüyü seç.
- prediction tek, açık ve kısa bir cümle olsun.
- checkAfterDays tam sayı olsun.
- checkAfterDays 1 ile 30 arasında olmalı.
- Yorumdaki zaman ifadesi varsa ona göre belirle.
- Açıklama, markdown veya ek metin yazma.

SADECE şu JSON formatında cevap ver:

{
  "prediction": "öngörü",
  "checkAfterDays": 7
}
`.trim(),
        },

        {
          role:
            "user",

          content:
            `MELEK YORUMU:\n\n${cleanInterpretation}`,
        },
      ],

      temperature:
        0.2,
    });

  const timeout =
    new Promise(
      (_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                "Melek prediction timeout"
              )
            ),
          10000
        );
      }
    );

  const completion =
    await Promise.race([
      predictionRequest,
      timeout,
    ]);

  const raw =
    (
      completion
        ?.choices?.[0]
        ?.message?.content ||
      ""
    )
      .replace(
        /```json/gi,
        ""
      )
      .replace(
        /```/g,
        ""
      )
      .trim();

  const parsed =
    JSON.parse(raw);

  const prediction =
    typeof parsed.prediction ===
    "string"
      ? parsed.prediction.trim()
      : "";

  const checkAfterDays =
    Number.parseInt(
      parsed.checkAfterDays,
      10
    );

  if (
    !prediction ||
    !Number.isInteger(
      checkAfterDays
    ) ||
    checkAfterDays < 1 ||
    checkAfterDays > 30
  ) {
    throw new Error(
      "Geçersiz melek prediction cevabı"
    );
  }

  return {
    prediction,
    checkAfterDays,
  };
}