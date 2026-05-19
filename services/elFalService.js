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

    const response =
      await openai.responses.create({
        model: "gpt-4o",

        input: [
          {
            role: "system",

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
            role: "user",

            content: [
              {
                type: "input_text",

                text:
                  "Fotoğrafı incele ve el falı yap.",
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
      "";

    if (
      result.includes(
        "[FOTO_OKUNAMADI]"
      )
    ) {
      return res.status(400).json({
        success: false,

        error:
          "El fotoğrafı net değil. Daha yakın ve aydınlık çekin.",
      });
    }

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