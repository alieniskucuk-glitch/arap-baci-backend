import OpenAI from "openai";
import { decreaseCoin } from "../utils/coinManager.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* =========================
   INSIGHT ID NORMALIZE
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

/* =========================
   SEMBOL HARİTASI + MİSTİK YIL
   - Mevcut El Falı akışından bağımsızdır
   - Hata verirse çalışan falı etkilemez
========================= */

async function generateElFaliInsights(
  interpretation
) {
  const cleanInterpretation =
    String(
      interpretation || ""
    ).trim();

  if (!cleanInterpretation) {
    return {
      symbols: [],
      themes: [],
      primaryTheme: null,
    };
  }

  try {
    const insightsRequest =
      openai.responses.create({
        model: "gpt-4.1-mini",

        input: [
          {
            role: "system",

            content: `
Verilen el falı yorumundan
Kişisel Sembol Haritası ve
Benim Mistik Yılım için
yapılandırılmış veri çıkar.

SEMBOL KURALLARI:

- Yalnızca el falı yorumunda
gerçekten görüldüğü veya belirgin
olduğu belirtilen çizgi, işaret,
şekil veya sembolleri çıkar.

- Yorumda olmayan sembol uydurma.

- Sıradan kullanılan mecazi
kelimeleri sembol olarak alma.

Örnek semboller:

Hayat Çizgisi
Kalp Çizgisi
Kader Çizgisi
Baş Çizgisi
Yıldız
Çatal
Ada
Haç
Üçgen
Kare
Kesinti
Birleşen Çizgiler

Ancak bunları yalnızca yorumda
gerçekten bahsedilmişse ekle.

- Aynı sembolü birden fazla ekleme.
- En fazla 8 sembol çıkar.
- name kısa ve Türkçe olsun.
- meaning sembolün BU EL FALINDAKİ
anlamını tek kısa cümleyle anlatsın.

TEMA KURALLARI:

- themes el falı yorumunun gerçekten
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
Güven
Yeni Başlangıç
Geçmiş
Gelecek
Duygusal Denge
İçsel Güç
Ruhsal Gelişim
İçsel Dönüşüm
Fırsat
Çatışma
Yolculuk

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
      "name": "Kalp Çizgisi",
      "meaning": "Duygusal bağların güçlü fakat temkinli ilerlediğini gösteriyor."
    }
  ],
  "themes": [
    "Aşk",
    "Karar"
  ],
  "primaryTheme": "Aşk"
}
`.trim(),
          },

          {
            role: "user",

            content: [
              {
                type: "input_text",

                text:
                  `EL FALI YORUMU:\n\n${cleanInterpretation}`,
              },
            ],
          },
        ],

        max_output_tokens: 500,
      });

    const timeout =
      new Promise(
        (_, reject) => {
          setTimeout(
            () =>
              reject(
                new Error(
                  "El Fali insights timeout"
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
      String(
        response?.output_text || ""
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

    if (!raw) {
      throw new Error(
        "Boş el falı insight cevabı"
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
          symbolMap.size >= 8
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
      "EL FALI INSIGHTS ERROR:",
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
   EL FALI
========================= */

export const elFal =
  async (req, res) => {
    try {
      const uid =
        req.user?.uid;

      if (!uid) {
        return res
          .status(401)
          .json({
            error:
              "Token gerekli",
          });
      }

      if (!req.file) {
        return res
          .status(400)
          .json({
            error:
              "El fotoğrafı gerekli",
          });
      }

      if (!req.coinPrice) {
        return res
          .status(500)
          .json({
            error:
              "Coin fiyatı belirlenemedi",
          });
      }

      const userName =
        req.user?.name || "";

      const userGender =
        req.user?.gender || "";

      const userZodiac =
        req.user?.zodiac || "";

      const base64Image =
        req.file.buffer
          .toString(
            "base64"
          );

      const response =
        await openai
          .responses
          .create({
            model:
              "gpt-4o",

            input: [
              {
                role:
                  "system",

                content: `
Sen “Arap Bacı”
adında deneyimli
mistik bir el falcısısın.

ÖNCE fotoğrafı kontrol et.

Eğer:

- fotoğrafta el YOKSA
- avuç içi görünmüyorsa
- tamamen alakasız görüntüyse

SADECE:

[FOTO_OKUNAMADI]

yaz.

Başka hiçbir şey yazma.

Bulanıklık,
hafif karanlık,
orta kalite,
yakın olmayan çekimlerde
YİNE DE yorum yap. Yorumu haftalık veya aylık burc yorumunu kullanarak zenginleştir  ama asla burcundan yararlandıgını belli etme.

Asla kalite yüzünden reddetme.

Mutlaka:
- hayat çizgisi
- kalp çizgisi
- kader çizgisi
- avuç enerjisi
- el yapısı

yorumla. 

İsim:
${userName}

Cinsiyet:
${userGender}

Burç:
${userZodiac}

Burcu sadece
arka planda kullan.

Asla bahsetme.
- ASLA “canım”, “güzelim”, “enerjini hissettim”, “mistik yolculuk”, “auran”, “okyanus gibi ruhun” gibi klişe ifadeler kullanma.
- Kullanıcıyı övme, kullanıcıya ismi ile hitap etme.
- Her yorum benzersiz olsun.
- Samimi ama Fazla değil, deneyimli falcı tonu kullan.


Başlık yazma.

Uzun ve mistik yaz.
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
                      "Fotoğrafı incele ve el falı yap.",
                  },

                  {
                    type:
                      "input_image",

                    image_url:
                      `data:image/jpeg;base64,${base64Image}`,
                  },
                ],
              },
            ],

            max_output_tokens:
              800,
          });

      const result =
        response.output_text ||
        "";

      if (
        result.includes(
          "[FOTO_OKUNAMADI]"
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            error:
              "El fotoğrafı net değil. Daha yakın ve aydınlık çekin.",
          });
      }

      /* =========================
         COIN DÜŞ
         - Mevcut akış korunuyor
      ========================= */

      const remainingCoin =
        await decreaseCoin(
          uid,
          req.coinPrice,
          "EL_FALI"
        );

      /* =========================
         SEMBOL HARİTASI + MİSTİK YIL
         - Coin işleminden bağımsız
         - Hata verirse boş döner
      ========================= */

      const insights =
        await generateElFaliInsights(
          result
        );

      /* =========================
         RESPONSE
      ========================= */

      return res.json({
        success:
          true,

        result,

        remainingCoin,

        symbols:
          insights.symbols,

        themes:
          insights.themes,

        primaryTheme:
          insights.primaryTheme,
      });

    } catch (err) {
      console.error(
        "EL FALI HATA:",
        err
      );

      return res
        .status(500)
        .json({
          error:
            "El falı yorumlanamadı",
        });
    }
  };