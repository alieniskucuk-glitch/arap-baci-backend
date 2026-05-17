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

    const userName = req.user?.name || "";
    const userGender = req.user?.gender || "";
    const userZodiac = req.user?.zodiac || "";

    const base64Image =
      req.file.buffer.toString("base64");

    /* =========================
       FOTO KALİTE KONTROL
    ========================= */

    const validation =
      await openai.responses.create({
        model: "gpt-4o-mini",

        input: [
          {
            role: "system",

            content: `
Fotoğraf kalite kontrol sistemi ol.

Sadece JSON döndür:

{
 "valid": true,
 "reason":""
}

veya

{
 "valid": false,
 "reason":"blur"
}

Kontrol:

- avuç içi var mı
- el kadrajda mı
- çizgiler seçiliyor mu
- çok bulanık mı
- çok karanlık mı
- çok uzak mı
- alakasız foto mu
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

        max_output_tokens: 100,
      });

    let isValid = true;

    try {
      const parsed = JSON.parse(
        validation.output_text || "{}"
      );

      isValid = parsed.valid === true;
    } catch {
      isValid = true;
    }

    if (!isValid) {
      return res.status(400).json({
        success: false,

        error:
          "El fotoğrafı okunamadı. Daha net ve yakın çekin.",
      });
    }

    /* =========================
       EL FALI
    ========================= */

    const response =
      await openai.responses.create({
        model: "gpt-4o",

        input: [
          {
            role: "system",

            content: `
Sen Arap Bacı adlı
mistik el falcısısın.

Yorumları kullanıcının
burcundan destek alarak yap.

Burçtan asla bahsetme.

İsim:
${userName}

Cinsiyet:
${userGender}

Burç:
${userZodiac}

Hayat çizgisi,
kalp çizgisi,
kader çizgisi,
avuç enerjisi
ve el yapısını yorumla.

Başlık yazma.

Uzun ve mistik yaz.
`,
          },

          {
            role: "user",

            content: [
              {
                type: "input_text",

                text:
                  "Bu el fotoğrafını yorumla",
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

    const remainingCoin =
      await decreaseCoin(
        uid,
        req.coinPrice,
        "EL_FALI"
      );

    return res.json({
      success: true,
      result,
      remainingCoin,
    });
  } catch (err) {
    console.error(
      "EL FALI HATA:",
      err
    );

    return res.status(500).json({
      error:
        "El falı yorumlanamadı",
    });
  }
};