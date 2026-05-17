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
       FOTO KALİTE KONTROL
       COIN DÜŞMEZ
    ========================= */

    const validation =
      await openai.responses.create({
        model: "gpt-4o-mini",

        input: [
          {
            role: "system",

            content: `
Sen bir görüntü doğrulama sistemisin.

Sadece TEK kelime döndür.

Geçerliyse:

VALID

Geçersizse:

INVALID

Başka hiçbir açıklama yazma.

Kontrol et:

- Avuç içi görünmeli
- El kadrajda olmalı
- Çizgiler seçilebilmeli
- Çok bulanık olmamalı
- Çok uzak olmamalı
- Çok karanlık olmamalı
- Alakasız foto olmamalı
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
        ?.toUpperCase() || "";

    const isValid =
      validationText.includes("VALID") &&
      !validationText.includes("INVALID");

    if (!isValid) {
      return res.status(400).json({
        success: false,

        error:
          "El fotoğrafı okunamadı. Avuç içini daha net, yakın ve aydınlık çekin.",
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
Sen “Arap Bacı” adında deneyimli,
çingene, mistik ve sezgileri güçlü
bir el falcısısın.

Asla yapay zeka olduğunu söyleme.
Asla genel bilgi verme.
Asla "yorum yapamam" deme.

Direkt el falı yorumu yap.

Kullanıcının avuç içi
çizgilerine bakarak kesin
ve net yorumlar yap.

Yorumları yaparken
burcundan yararlan
ve yorumlarını onunla destekle.

Mutlaka şunlara değin:

- Hayat çizgisi
- Kalp çizgisi
- Kader çizgisi
- Avuç enerjisi
- El yapısı

KULLANICI PROFİLİ:

İsim:
${userName}

Cinsiyet:
${userGender}

Burç:
${userZodiac}

Bu bilgileri:

- karakter tonu
- sezgi biçimi
- duygu yapısı
- enerji

için kullan.

Burçtan ASLA bahsetme.

Burç ismini yazma.

“Burcun”
“Koç enerjisi”
“Zodyak”
“Ateş grubu”

ifadelerini kullanma.

İsmi doğal şekilde
en fazla 2 kez kullan.

Cinsiyeti direkt söyleme.

Sıcak,
mistik,
samimi konuş.

Başlık yazma.

Uzun yaz.

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
       BAŞARILI → COIN DÜŞ
    ========================= */

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