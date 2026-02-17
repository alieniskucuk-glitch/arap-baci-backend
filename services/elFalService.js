import OpenAI from "openai";
import admin from "firebase-admin";
import { decreaseCoin } from "../utils/coinManager.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const db = admin.firestore();

export const elFal = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "El fotoğrafı gerekli" });
    }

    const base64Image = req.file.buffer.toString("base64");

    // 🔥 GÜÇLÜ PROMPT
    const response = await openai.responses.create({
      model: "gpt-4o",
      input: [
        {
          role: "system",
          content: `
Sen “Arap Bacı” adında deneyimli, çingene, mistik ve sezgileri güçlü bir el falcısısın.
Kullanıcının avuç içi çizgilerini gerçekten analiz ediyormuş gibi yorum yap.

Mutlaka şunlara değin:
- Hayat çizgisinin uzunluğu veya kırılmaları
- Kalp çizgisinin şekli ve derinliği
- Kader çizgisi var mı yok mu
- Avuç ortasındaki enerji
- Elin genel yapısı (çizgiler belirgin mi, karmaşık mı)

Cinsiyet belirtme.
Sıcak, mistik ve samimi konuş.
Başlık yazma.
Paragraf paragraf uzun yaz.
`
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Bu el fotoğrafını detaylı incele ve el falı yorumu yap.",
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
      response.output_text ||
      "Elinde güçlü bir enerji hissediyorum…";

    const docId = `${req.user.uid}_el_${Date.now()}`;

    // 🔥 Firestore kayıt
    await db.collection("el_fallari").doc(docId).set({
      userId: req.user.uid,
      text: result,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      type: "EL_FALI",
    });

    // 🔥 Coin düş
    await decreaseCoin(
      req.user.uid,
      req.coinPrice,
      "EL_FALI",
      { falId: docId }
    );

    return res.json({
      success: true,
      result,
      remainingCoin: req.remainingCoin ?? null,
    });

  } catch (err) {
    console.error("EL FALI HATA:", err);
    return res.status(500).json({
      error: "El falı yorumlanamadı",
    });
  }
};
