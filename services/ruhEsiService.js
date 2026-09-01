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

   Mevcut Ruh Eşi akışından bağımsızdır.
   Hata verirse mevcut falı etkilemez.
========================= */

async function generateRuhEsiInsights(result) {
  const cleanResult =
    String(result || "").trim();

  if (!cleanResult) {
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
Verilen Ruh Eşi uyum yorumundan
Kişisel Sembol Haritası ve
Benim Mistik Yılım için
yapılandırılmış veri çıkar.

SEMBOL KURALLARI:

- Yalnızca yorumda gerçekten
sembolik anlam taşıyan işaret,
nesne veya arketipleri çıkar.

- Sıradan kullanılan kelimeleri
sembol olarak alma.

- Yorumda olmayan sembol uydurma.

- En fazla 6 sembol çıkar.

- Aynı sembolü birden fazla
kez ekleme.

- name kısa ve Türkçe olsun.

- meaning sembolün bu uyum
yorumundaki anlamını tek kısa
cümleyle anlatsın.

TEMA KURALLARI:

- themes yalnızca yorumun
gerçekten baskın konularını içersin.

- En fazla 5 tema çıkar.

- Tema isimlerini kısa ve
tekrar kullanılabilir biçimde yaz.

Tercih edilen tema örnekleri:

Aşk
İlişki
Güven
İletişim
Çekim
Uyum
Çatışma
Bağlılık
Karar
Değişim
Gelecek
Ruhsal Bağ
Duygusal Yakınlık
Uzun Vadeli Potansiyel

- Aynı anlama gelen birden fazla
tema üretme.

- primaryTheme,
themes içindeki en baskın
tek tema olmalı.

- Tema yoksa themes boş dizi olsun.

- Tema yoksa primaryTheme null olsun.

Açıklama yazma.
Markdown yazma.
Ek metin yazma.

SADECE şu JSON formatında cevap ver:

{
  "symbols": [
    {
      "name": "Köprü",
      "meaning": "İki kişi arasında kurulmaya çalışan bağı temsil ediyor."
    }
  ],
  "themes": [
    "İletişim",
    "Ruhsal Bağ"
  ],
  "primaryTheme": "Ruhsal Bağ"
}
`.trim(),
          },

          {
            role: "user",

            content:
              `RUH EŞİ UYUM YORUMU:\n\n${cleanResult}`,
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
                  "Ruh Esi insights timeout"
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
        response
          ?.choices?.[0]
          ?.message?.content || ""
      )
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    if (!raw) {
      throw new Error(
        "Bos Ruh Esi insight cevabi"
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
          typeof item?.name === "string"
            ? item.name.trim()
            : "";

        if (!name) {
          continue;
        }

        const id =
          normalizeInsightId(
            name
          );

        if (!id) {
          continue;
        }

        if (
          symbolMap.has(id)
        ) {
          continue;
        }

        const meaning =
          typeof item?.meaning === "string"
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
          typeof item !== "string"
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

    if (rawPrimaryTheme) {
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

      if (matchedTheme) {
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
      "RUH ESI INSIGHTS ERROR:",
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
   RUH ESI
========================= */

export const ruhEsi = async (req, res) => {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({
        error: "Token gerekli"
      });
    }

    if (!req.coinPrice) {
      return res.status(500).json({
        error:
          "Coin fiyatı belirlenemedi"
      });
    }

    const option =
      parseInt(
        req.body.option,
        10
      );

    if (
      ![1, 2, 3].includes(option)
    ) {
      return res.status(400).json({
        error:
          "Uyum türü belirlenemedi"
      });
    }

    const {
      p1Name,
      p1Birth,
      p2Name,
      p2Birth
    } = req.body;

    let prompt = `
Sen Arap Bacı evrenindeki mistik bir ruh uyumu uzmanısın.

İki kişi arasındaki enerjiyi değerlendirirken:

- isim titreşimleri
- numerolojik uyum
- yaşam yolu eğilimleri
- doğum tarihi enerjileri
- duygusal çekim
- ruhsal bağ
- ilişki dinamikleri
- tamamlayıcılık ve çatışma alanları

üzerinden analiz yap.

Yorumu mutlaka kişiselleştir.

Kişilerin isimlerini yorum içinde kullan.

Analiz tek tip olmamalı.

Her eşleşme farklı hissettirmeli.

Uyum oranı üretirken
yalnızca rastgele davranma.

İsimler ve doğum tarihleri
arasındaki enerjiye göre karar ver.

Yüzde tek başına yeterli değil.

Şunlardan bahset:

- ilk enerji hissi
- duygusal uyum
- iletişim
- çekim
- uzun vadeli potansiyel
- güçlü taraflar
- zorlayıcı alanlar
- ruh eşi hissi

Dil büyüleyici,
mistik ve etkileyici olsun.

En az 500+ token uzunluğunda yaz.

SADECE JSON döndür.

Format:

{
   "percent": number,
   "result": "yorum"
}
`;

    /* ================= OPTION 1 ================= */

    if (option === 1) {
      if (
        !p1Name ||
        !p1Birth ||
        !p2Name ||
        !p2Birth
      ) {
        return res.status(400).json({
          error:
            "İsim ve doğum tarihleri gerekli"
        });
      }

      prompt += `
1. Kişi:
İsim: ${p1Name}
Doğum Tarihi: ${p1Birth}

2. Kişi:
İsim: ${p2Name}
Doğum Tarihi: ${p2Birth}
`;
    }

    /* ================= OPTION 2 ================= */

    if (option === 2) {
      if (
        !req.files?.p1Hand ||
        !req.files?.p2Hand
      ) {
        return res.status(400).json({
          error:
            "İki el fotoğrafı gerekli"
        });
      }

      prompt += `
Enerji çizgilerine dayalı ruhsal eşleşme analizi yap.
El çizgilerinin uyumuna odaklan.
`;
    }

    /* ================= OPTION 3 ================= */

    if (option === 3) {
      if (
        !p1Name ||
        !p1Birth ||
        !p2Name ||
        !p2Birth
      ) {
        return res.status(400).json({
          error:
            "İsim ve doğum tarihleri gerekli"
        });
      }

      if (
        !req.files?.p1Hand ||
        !req.files?.p2Hand
      ) {
        return res.status(400).json({
          error:
            "İki el fotoğrafı gerekli"
        });
      }

      prompt += `
1. Kişi:
İsim: ${p1Name}
Doğum Tarihi: ${p1Birth}

2. Kişi:
İsim: ${p2Name}
Doğum Tarihi: ${p2Birth}

El çizgileri + numeroloji + sinastri kombinasyonu ile
derin ruhsal bağ analizi yap.
Daha güçlü ve etkileyici yorum yaz.
`;
    }

    /* ================= OPENAI ================= */

    const response =
      await openai
        .chat
        .completions
        .create({
          model:
            "gpt-4o",

          messages: [
            {
              role:
                "user",

              content:
                prompt
            }
          ],

          temperature:
            0.9,
        });

    const raw =
      response
        .choices?.[0]
        ?.message?.content || "";

    /* =========================
       MARKDOWN TEMİZLE
    ========================= */

    const cleaned =
      raw
        .replace(
          /```json/gi,
          ""
        )
        .replace(
          /```/g,
          ""
        )
        .trim();

    let parsed;

    try {
      parsed =
        JSON.parse(
          cleaned
        );

    } catch {
      parsed = {
        percent:
          Math.floor(
            Math.random() * 40
          ) + 60,

        result:
          cleaned,
      };
    }

    const percent =
      Math.min(
        100,

        Math.max(
          0,

          Number(
            parsed.percent
          ) || 0
        )
      );

    /* =========================
       COIN + INSIGHTS

       Insight işlemi mevcut
       sonucu bozmaz.

       Insight hata verirse
       kendi içinde boş döner.
    ========================= */

    const [
      remainingCoin,
      insights,
    ] =
      await Promise.all([
        decreaseCoin(
          uid,
          req.coinPrice,
          "UYUM",
          {
            percent
          }
        ),

        generateRuhEsiInsights(
          parsed.result
        ),
      ]);

    /* ================= RESPONSE ================= */

    return res.status(200).json({
      percent,

      result:
        parsed.result,

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
      "RUH ESI ERROR:",
      err
    );

    return res.status(500).json({
      error:
        "Uyum analizi yapılamadı",
    });
  }
};