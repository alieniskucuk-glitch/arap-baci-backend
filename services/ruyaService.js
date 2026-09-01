import OpenAI from "openai";
import { decreaseCoin } from "../utils/coinManager.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* =========================
   SEMBOL ID NORMALIZE
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
   SEMBOL HARİTASI
   +
   MİSTİK YIL

   Mevcut rüya yorum akışından
   tamamen bağımsızdır.

   Hata verirse boş veri döner,
   mevcut rüya falı etkilenmez.
========================= */

async function generateRuyaInsights(
  dream,
  interpretation
) {
  const cleanDream =
    String(dream || "").trim();

  const cleanInterpretation =
    String(
      interpretation || ""
    ).trim();

  if (!cleanDream) {
    return {
      symbols: [],
      themes: [],
      primaryTheme: null,
    };
  }

  try {
    const prompt = `
Aşağıdaki kullanıcının gerçek rüya metnini
ve bu rüya için oluşturulmuş yorumu incele.

Amaç:

1. Kişisel Sembol Haritası için
rüyada gerçekten görülen sembolleri çıkarmak.

2. Benim Mistik Yılım için
rüyanın baskın temalarını çıkarmak.

RÜYA:

"${cleanDream}"

RÜYA YORUMU:

"${cleanInterpretation}"

SEMBOL KURALLARI:

- symbols yalnızca kullanıcının RÜYA METNİNDE
gerçekten gördüğünü, yaşadığını veya karşılaştığını
anlattığı sembollerden oluşmalı.

- Rüya yorumunda sonradan kullanılan mecazi
kelimeleri sembol olarak ekleme.

Örnek:

Kullanıcı rüyasında gerçekten bir kapı gördüyse
"Kapı" semboldür.

Ama yorumda
"önünde yeni bir kapı açılabilir"
denmiş fakat rüyada kapı yoksa
"Kapı" sembol değildir.

- Nesneler sembol olabilir.
- Hayvanlar sembol olabilir.
- İnsan figürleri sembol olabilir.
- Mekânlar sembol olabilir.
- Doğa olayları sembol olabilir.
- Renkler ancak rüyada belirgin biçimde
vurgulanmışsa sembol olabilir.
- Sayılar ancak rüyada özellikle görülmüşse
sembol olabilir.
- Yol, kapı, anahtar, deniz, yılan,
kuş, ev, bebek, araba gibi gerçekten
görülen unsurlar sembol olabilir.

- Uydurma sembol ekleme.
- Aynı sembolü birden fazla ekleme.
- En fazla 10 sembol çıkar.
- name kısa ve Türkçe olsun.
- meaning sembolün BU RÜYADAKİ anlamını
tek kısa cümleyle anlatsın.

TEMA KURALLARI:

- themes rüya ve rüya yorumunun
gerçekten baskın konularını göstermeli.

- En fazla 5 tema kullan.

- Tema isimlerini kısa ve tekrar
kullanılabilecek şekilde oluştur.

Tercih edilen tema biçimleri:

Aşk
İlişki
Aile
Kariyer
Para
Değişim
Karar
Korku
Kaygı
Özgürlük
Yeni Başlangıç
Geçmiş
Kayıp
Güven
Çatışma
Ruhsal Gelişim
İçsel Dönüşüm
Sosyal Hayat
Sağlık
Yolculuk

- Aynı anlama gelen iki ayrı tema üretme.
- primaryTheme themes listesindeki
en baskın tek tema olmalı.
- Tema yoksa themes boş dizi olsun.
- Tema yoksa primaryTheme null olsun.

Açıklama yazma.
Markdown yazma.
Kod bloğu yazma.
Ek metin yazma.

SADECE şu JSON formatında cevap ver:

{
  "symbols": [
    {
      "name": "Anahtar",
      "meaning": "Çözüm arayışını ve yeni bir fırsatı temsil ediyor."
    }
  ],
  "themes": [
    "Değişim",
    "Karar"
  ],
  "primaryTheme": "Değişim"
}
`.trim();

    const insightsRequest =
      openai.responses.create({
        model:
          "gpt-4.1-mini",

        input:
          prompt,

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
                  "Ruya insights timeout"
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
        "Boş insight cevabı"
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

        if (!id) {
          continue;
        }

        if (
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
      typeof parsed
        .primaryTheme ===
        "string"
        ? parsed
            .primaryTheme
            .trim()
        : "";

    let primaryTheme =
      null;

    if (
      rawPrimaryTheme
    ) {
      const matchedTheme =
        themes.find(
          (theme) =>
            theme
              .toLocaleLowerCase(
                "tr-TR"
              ) ===
            rawPrimaryTheme
              .toLocaleLowerCase(
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
      "RUYA INSIGHTS ERROR:",
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
   RÜYA YORUMLA
========================= */

export const ruyaYorumla =
  async (req, res) => {
    try {

      const uid =
        req.user?.uid;

      if (!uid) {
        return res
          .status(401)
          .json({
            error:
              "Token gerekli"
          });
      }

      if (!req.coinPrice) {
        return res
          .status(500)
          .json({
            error:
              "Coin fiyatı belirlenemedi"
          });
      }

      const {
        dream
      } = req.body;

      if (
        !dream ||
        dream.trim().length < 5
      ) {
        return res
          .status(400)
          .json({
            error:
              "Rüya metni çok kısa"
          });
      }

      const user =
        req.ruyaUser || {};

      const prompt = `
Sen Arap Bacı adında
mistik ve sezgileri güçlü
bir rüya yorumcususun.

Kullanıcının isim,
burç ve cinsiyet
bilgilerini kullanarak
yorumu kişiselleştir.

Ancak burçlardan
yararlandığını belli etme.

Burç adı veya
astrolojik ifade yazma.

KULLANICI:

İsim:
${user.name || ""}

Burç:
${user.zodiac || ""}

Cinsiyet:
${user.gender || ""}

RÜYA:

"${dream}"

Rüyayı yorumlarken:

- Psikolojik anlam
- Sembolik anlam
- Bilinçaltı mesajı
- Yakın gelecek
- Geçmiş bağlantıları
- Ruhsal mesajlar
- Genel tavsiyeler

işlenmeli.

Kullanıcının adıyla
doğal hitap et.

Başlık yazma.

Paragraf paragraf anlat.


- ASLA “canım”, “güzelim”, “enerjini hissettim”, “mistik yolculuk”, “auran”, “okyanus gibi ruhun” gibi klişe ifadeler kullanma.
- Fal içinde kullanıcının adını doğal akışa uygun şekilde 1 veya 2 kez kullan. 
- Genel kişilik analizi yapma.
- Kullanıcıyı övme.
- Her yorum benzersiz olsun.
- Samimi, sıcak, gizemli bir dil kullan ama fazla abartma, deneyimli falcı tonu kullan.
- Kullanıcıyı memnun etmek için yorumu olumluya çevirme; ne görüyorsan onu dengeli ve dürüst yorumla. Olumsuz işaretleri yumuşatma, her falı umut veren bir sonuca bağlama.


En az yaklaşık
700 token uzunluğunda yaz.
`;

      /* =========================
         GPT
      ========================= */

      const response =
        await openai
          .responses
          .create({

            model:
              "gpt-4.1-mini",

            input:
              prompt,

            max_output_tokens:
              1200,
          });

      const result =
        response.output_text ||

        "Rüyanda güçlü bir mesaj var ama biraz daha dikkatle düşünmelisin...";

      /* =========================
         COIN + INSIGHTS

         Coin mevcut şekilde
         yorum üretildikten sonra düşer.

         Insight ayrı çalışır.
         Hata verirse boş veri döner.
      ========================= */

      const [
        remainingCoin,
        insights,
      ] =
        await Promise.all([
          decreaseCoin(
            uid,
            req.coinPrice,
            "RUYA"
          ),

          generateRuyaInsights(
            dream,
            result
          ),
        ]);

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
        "RUYA ERROR:",
        err
      );

      return res
        .status(500)
        .json({
          error:
            "Rüya yorumlanamadı",
        });
    }
  };