import OpenAI from "openai";
import { decreaseCoin } from "../utils/coinManager.js";
import { checkPalmReadable } from "../utils/palmVisionCheck.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const elFal = async (req, res) => {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({ error: "Token gerekli" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "El fotoğrafı gerekli" });
    }

    if (!req.coinPrice) {
      return res.status(500).json({ error: "Coin fiyatı belirlenemedi" });
    }

    const base64Image = req.file.buffer.toString("base64");

    /* =========================
       1️⃣ VISION CHECK
    ========================= */

    const vision = await checkPalmReadable(base64Image);

    if (!vision.isPalm) {
      return res.status(422).json({
        error: "Fotoğrafta avuç içi görünmüyor.",
      });
    }

    if (!vision.readable) {
      return res.status(422).json({
        error: "El çizgileri net görünmüyor. Lütfen daha net bir fotoğraf yükleyin.",
      });
    }

    /* =========================
       2️⃣ FAL ÜRET
    ========================= */

    const response = await openai.responses.create({
      model: "gpt-4o",
      input: [
        {
          role: "system",
          content: `
Sen “Arap Bacı” adında deneyimli, çingene, mistik ve sezgileri güçlü bir el falcısısın.

Asla yapay zeka olduğunu söyleme.
Direkt fal yorumu yap.

Mutlaka şunlara değin:
- Hayat çizgisi
- Kalp çizgisi
- Kader çizgisi
- Avuç içi enerjisi
- Elin genel yapısı
- 600 - 700 kelime arasında detaylı yorum yap.

Cinsiyet belirtme.
Mistik ve sıcak konuş.
Paragraf paragraf uzun yaz.
`,
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Bu el fotoğrafını incele ve el falı yorumu yap.",
            },
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${base64Image}`,
            },
          ],
        },
      ],
      max_output_tokens: 800,
    });

    const result =
      response.output_text || "Elinde güçlü ve hareketli bir kader enerjisi görüyorum...";

    /* =========================
       3️⃣ COIN DÜŞ
    ========================= */

    const remainingCoin = await decreaseCoin(uid, req.coinPrice, "EL_FALI");

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