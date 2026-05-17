import OpenAI from "openai";
import { decreaseCoin } from "../utils/coinManager.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const elFal = async (req, res) => {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({
        error: "Token gerekli",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "El fotoğrafı gerekli",
      });
    }

    if (!req.coinPrice) {
      return res.status(500).json({
        error: "Coin fiyatı belirlenemedi",
      });
    }

    /* =========================
       USER PROFİL
    ========================= */

    const userName = req.user?.name || "";
    const userGender = req.user?.gender || "";
    const userZodiac = req.user?.zodiac || "";

    /* =========================
       IMAGE
    ========================= */

    const base64Image =
      req.file.buffer.toString("base64");

    /* =========================
       FOTOĞRAF VALIDATION
    ========================= */

    const validation =
      await openai.responses.create({
        model: "gpt-4o-mini",

        input: [
          {
            role: "system",

            content: `
Sen bir görüntü doğrulama sistemisin.

Sadece şunları kontrol et:

- Fotoğrafta avuç içi net görünüyor mu?
- El kadrajda mı?
- Çizgiler okunabilir mi?
- Fotoğraf çok bulanık mı?
- Çok karanlık mı?
- Çok uzak mı?
- Tamamen alakasız görüntü mü?

Eğer el falı yapılabilecek kalite varsa sadece:

VALID

yaz.

Eğer kalite yetersizse sadece:

INVALID

yaz.
`,
          },

          {
            role: "user",

            content: [
              {
                type: "input_image",

                image_url:
                  `data:image/jpeg;base64,${base64Image}`,
              },
            ],
          },
        ],

        max_output_tokens: 10,
      });

    const validationText =
      validation.output_text
        ?.trim()
        ?.toUpperCase();

    if (validationText !== "VALID") {
      return res.status(400).json({
        success: false,

        error:
          "El fotoğrafı net değil. Avuç içini daha yakın, aydınlık ve net şekilde çekin.",
      });
    }

    /* =========================
       GPT İŞLEMİ
    ========================= */

    const response =
      await openai.responses.create({
        model: "gpt-4o",

        input: [
          {
            role: "system",

            content: `
Sen “Arap Bacı” adında deneyimli, çingene,
mistik ve sezgileri güçlü bir el falcısısın.

Asla yapay zeka olduğunu söyleme.
Asla genel bilgi verme.
Asla "yorum yapamam" deme.

Direkt el falı yorumu yap.

Kullanıcının avuç içi çizgilerine bakarak
kesin ve net yorumlar yap.

Yorumları yaparken burcundan yararlan
ve yorumlarını onunla destekle.

Mutlaka şunlara değin:

- Hayat çizgisinin uzunluğu,
  kırılması veya enerjisi

- Kalp çizgisinin derinliği
  ve duygusal yapı

- Kader çizgisi var mı yok mu

- Avuç ortasındaki enerji

- Elin genel yapısı
  (çizgiler belirgin mi,
   karmaşık mı)

KULLANICI PROFİLİ:

İsim: ${userName}

Cinsiyet: ${userGender}

Burç: ${userZodiac}

Bu bilgileri SADECE:

- yorumun enerjisini
- karakter tonunu
- duygusal yaklaşımı
- sezgi biçimini

belirlemek için kullan.

Burçtan ASLA bahsetme.

Burç ismini ASLA yazma.

“Koç enerjisi”,
“burcun”,
“zodyak”,
“ateş grubu”
gibi ifadeler kullanma.

Kullanıcının ismini doğal şekilde
en fazla 2 kez kullan.

Cinsiyeti direkt söyleme.

Hitap tonunu doğal şekilde ayarla.

Yorum tamamen doğal görünmeli.

Sıcak, mistik ve samimi konuş.

Başlık yazma.

Paragraf paragraf uzun yaz.

Kehanet tonu kullan.
`,
          },

          {
            role: "user",

            content: [
              {
                type: "input_text",

                text:
                  "Bu el fotoğrafını incele ve el falı yorumu yap.",
              },

              {
                type: "input_image",

                image_url:
                  `data:image/jpeg;base64,${base64Image}`,
              },
            ],
          },
        ],

        max_output_tokens: 800,
      });

    const result =
      response.output_text ||
      "Elinde güçlü bir enerji hissediyorum…";

    /* =========================
       RESULT OK → COIN DÜŞ
    ========================= */

    const remainingCoin =
      await decreaseCoin(
        uid,
        req.coinPrice,
        "EL_FALI"
      );

    /* =========================
       RESPONSE
    ========================= */

    return res.json({
      success: true,
      result,
      remainingCoin,
    });
  } catch (err) {
    console.error("EL FALI HATA:", err);

    return res.status(500).json({
      error: "El falı yorumlanamadı",
    });
  }
};