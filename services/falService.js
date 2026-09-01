import openai from "../config/openai.js";
import {
  extractText,
  imagesToOpenAI
} from "../utils/helpers.js";

/* =========================
   PROMPTS (KORUNDU)
========================= */

export const FULL_PROMPT = `
Sen “Arap Bacı” adında tecrübeli,
mistik ve sevecen bir kahve falcısısın.

Fincandaki imgelere göre
detaylı ve uzun bir fal yaz.


Kullanıcının isim, cinsiyet ve burç
bilgilerine göre yorumu
kişiselleştir.

Burç bilgisi yalnızca yorumun tonunu,
karakter eğilimlerini ve yaklaşımını
kişiselleştirmek için kullanılmalı.

- ASLA “canım”, “güzelim”, “enerjini hissettim”, “mistik yolculuk”, “auran”, “okyanus gibi ruhun” gibi klişe ifadeler kullanma.
- Fal içinde kullanıcının adını doğal akışa uygun şekilde 1 veya 2 kez kullan. 
- İlk paragraf mutlaka fincanın görsel yoğunluğu, dip, kenar, sembol veya akış analiziyle başlasın.
- Genel kişilik analizi yapma.
- Kullanıcıyı övme.
- Her yorum benzersiz olsun.
- Fazla samimi değil, deneyimli falcı tonu kullan.
- “Sana şunu söylüyor”, “burada görünen şey” tarzı doğal dil kullan.
- Kullanıcıyı memnun etmek için yorumu olumluya çevirme; ne görüyorsan onu dengeli ve dürüst yorumla. Olumsuz işaretleri yumuşatma, her falı umut veren bir sonuca bağlama.


Burç adı veya astrolojik referanslar
doğrudan yazılmamalı.


Falı yorumlarken
gördüğün imgelerden
bahset.

En az 900 token uzunluğunda,
detaylı ve dolu bir yorum üret.

Her bölüm için ayrı enerji,
sembol ve yorumlar ekle.

Fal uzun ve doyurucu olmalı.

BAŞLIKLAR:

1. Genel Enerji
2. Simgeler
3. Geçmiş
4. Aşk
5. Para / İş
6. Yakın Gelecek
7. Özet

Ama başlıkları yazmadan
paragraf paragraf anlat.
`;

/* =========================
   TEK SERVICE
========================= */

export async function generateFal(
  files,
  user = {}
) {

  const profileText = `
KULLANICI:

İsim:
${user.name || ""}

Burç:
${user.zodiac || ""}

Cinsiyet:
${user.gender || ""}
`;

  const r =
    await openai.responses.create({

      model: "gpt-4o",

      temperature: 0.85,

      input: [

        {
          role: "system",
          content:
            FULL_PROMPT
        },

        {
          role: "user",

          content: [

            {
              type:
                "input_text",

              text:
`
${profileText}

Detaylı ve uzun
kahve falı yorumla.

Fincandaki şekilleri
yorumla.

İsim, cinsiyet ve burca göre
kişiselleştir.

Burç bilgisi yalnızca yorumun tonunu,
karakter eğilimlerini ve yaklaşımını
kişiselleştirmek için kullanılmalı.

Burç adı veya astrolojik referanslar
doğrudan yazılmamalı.
`
            },

            ...imagesToOpenAI(
              files
            ),

          ],
        },
      ],

      max_output_tokens:
        1500,
    });

  return extractText(r);
}

/* =========================
   KEHANET KASASI
   - Mevcut fal üretimini değiştirmez
   - Ayrı yardımcı çağrıdır
========================= */

export async function generateFalPrediction(
  falText
) {
  const cleanFal =
    String(falText || "").trim();

  if (!cleanFal) {
    return {
      prediction: null,
      checkAfterDays: null,
    };
  }

  const predictionRequest =
    openai.responses.create({
      model: "gpt-4.1-mini",

      input: [
        {
          role: "system",
          content: `
Verilen kahve falı yorumundan
Kehanet Kasası için
tek bir gelecek öngörüsü çıkar.

Kurallar:

- Fal metninde olmayan yeni bir olay uydurma.
- Yalnızca geleceğe yönelik en net ve sonradan kontrol edilebilir öngörüyü seç.
- prediction tek, açık ve kısa bir cümle olsun.
- checkAfterDays tam sayı olsun.
- checkAfterDays 1 ile 30 arasında olmalı.
- Fal metnindeki zaman ifadesi varsa ona göre belirle.
- Açıklama, markdown veya ek metin yazma.

SADECE şu JSON formatında cevap ver:

{
  "prediction": "öngörü",
  "checkAfterDays": 7
}
`,
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                `KAHVE FALI:\n\n${cleanFal}`,
            },
          ],
        },
      ],

      max_output_tokens: 180,
    });

  const timeout = new Promise(
    (_, reject) => {
      setTimeout(
        () => reject(
          new Error(
            "Prediction timeout"
          )
        ),
        10000
      );
    }
  );

  const response =
    await Promise.race([
      predictionRequest,
      timeout,
    ]);

  const raw =
    extractText(response)
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

  const parsed =
    JSON.parse(raw);

  const prediction =
    typeof parsed.prediction === "string"
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
      "Geçersiz prediction cevabı"
    );
  }

  return {
    prediction,
    checkAfterDays,
  };
}

/* =========================
   SEMBOL HARİTASI + MİSTİK YIL
   - Mevcut kahve falı akışından bağımsızdır
   - Hata verirse çalışan falı etkilemez
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

export async function generateFalInsights(
  falText
) {
  const cleanFal =
    String(falText || "").trim();

  if (!cleanFal) {
    return {
      symbols: [],
      themes: [],
      primaryTheme: null,
    };
  }

  try {

    const insightsRequest =
      openai.responses.create({

        model:
          "gpt-4.1-mini",

        input: [
          {
            role:
              "system",

            content: `
Verilen kahve falı yorumundan
Kişisel Sembol Haritası ve
Benim Mistik Yılım için
yapılandırılmış veri çıkar.

ÖNEMLİ:

Kahve falı yorum metni,
fincan görselleri analiz edilerek
oluşturulmuştur.

SEMBOL KURALLARI:

- Yalnızca fal yorumunda
fincanda gerçekten görüldüğü
belirtilen şekil, figür,
işaret veya sembolleri çıkar.

- Falcının mecazi anlatım için
kullandığı kelimeleri sembol sayma.

Örnek:

"Fincanın kenarında kuş figürü var"
ise Kuş semboldür.

Ama:

"Özgür bir kuş gibi hissedeceksin"
denmiş fakat fincanda kuş görülmemişse
Kuş sembol değildir.

- Hayvan figürleri sembol olabilir.
- İnsan siluetleri sembol olabilir.
- Harfler sembol olabilir.
- Sayılar sembol olabilir.
- Nesneler sembol olabilir.
- Yol, kapı, anahtar, kalp, yıldız,
kuş, balık, ağaç, yüzük gibi
fincanda gerçekten görülen şekiller
sembol olabilir.

- Yorumda görülmediği halde
sembol uydurma.

- Aynı sembolü birden fazla
kez ekleme.

- En fazla 10 sembol çıkar.

- name kısa ve Türkçe olsun.

- meaning sembolün bu fal içindeki
anlamını tek kısa cümleyle anlatsın.

TEMA KURALLARI:

- themes falın gerçekten
baskın konularını temsil etsin.

- En fazla 5 tema çıkar.

- Tema isimleri kısa ve
tekrar kullanılabilir olsun.

Tercih edilen tema örnekleri:

Aşk
İlişki
Aile
Kariyer
Para
Değişim
Karar
Yeni Başlangıç
Yolculuk
Haber
Geçmiş
Güven
Çatışma
Fırsat
Bekleyiş
Sosyal Hayat
Ruhsal Gelişim
İçsel Dönüşüm

- Aynı anlama gelen
birden fazla tema üretme.

- primaryTheme,
themes içindeki en baskın
tek tema olmalı.

- Tema yoksa
themes boş dizi olsun.

- Tema yoksa
primaryTheme null olsun.

Açıklama yazma.
Markdown yazma.
Kod bloğu yazma.
Ek metin yazma.

SADECE şu JSON formatında cevap ver:

{
  "symbols": [
    {
      "name": "Kuş",
      "meaning": "Yaklaşan bir haberi temsil ediyor."
    }
  ],
  "themes": [
    "Haber",
    "Değişim"
  ],
  "primaryTheme": "Haber"
}
`,
          },

          {
            role:
              "user",

            content: [
              {
                type:
                  "input_text",

                text:
                  `KAHVE FALI:\n\n${cleanFal}`,
              },
            ],
          },
        ],

        max_output_tokens:
          500,
      });

    const timeout =
      new Promise(
        (_, reject) => {

          setTimeout(
            () =>
              reject(
                new Error(
                  "Fal insights timeout"
                )
              ),
            10000
          );
        }
      );

    const response =
      await Promise.race([
        insightsRequest,
        timeout,
      ]);

    const raw =
      extractText(response)
        .replace(
          /```json/gi,
          ""
        )
        .replace(
          /```/g,
          ""
        )
        .trim();

    if (!raw) {
      throw new Error(
        "Boş fal insight cevabı"
      );
    }

    const parsed =
      JSON.parse(raw);

    /* =========================
       SYMBOLS
    ========================= */

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
          normalizeInsightId(
            name
          );

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
          symbolMap.size >= 10
        ) {
          break;
        }
      }
    }

    /* =========================
       THEMES
    ========================= */

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
          theme
            .toLocaleLowerCase(
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

    /* =========================
       PRIMARY THEME
    ========================= */

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
      "FAL INSIGHTS ERROR:",
      err
    );

    return {
      symbols: [],
      themes: [],
      primaryTheme: null,
    };
  }
}