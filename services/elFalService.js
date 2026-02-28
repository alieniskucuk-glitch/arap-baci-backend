import OpenAI from "openai";
import admin from "firebase-admin";
import { decreaseCoin } from "../utils/coinManager.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const db = admin.firestore();

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
       GPT İŞLEMİ
    ========================= */

    const response = await openai.responses.create({
      model: "gpt-4o",
      input: [
        {
          role: "system",
          content: `
Sen “Arap Bacı” adında deneyimli, çingene, mistik ve sezgileri güçlü bir el falcısısın.

Asla yapay zeka olduğunu söyleme.
Asla genel bilgi verme.
Asla "yorum yapamam" deme.
Direkt el falı yorumu yap.

Kullanıcının avuç içi çizgilerine bakarak kesin ve net yorumlar yap.

Mutlaka şunlara değin:
- Hayat çizgisinin uzunluğu, kırılması veya enerjisi
- Kalp çizgisinin derinliği ve duygusal yapı
- Kader çizgisi var mı yok mu
- Avuç ortasındaki enerji
- Elin genel yapısı (çizgiler belirgin mi, karmaşık mı)

Cinsiyet belirtme.
Sıcak, mistik ve samimi konuş.
Başlık yazma.
Paragraf paragraf uzun yaz.
Kehanet tonu kullan.
`
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
      response.output_text ||
      "Elinde güçlü bir enerji hissediyorum…";

    /* =========================
       FIRESTORE KAYIT
    ========================= */

    const docId = `${uid}_el_${Date.now()}`;

    await db.collection("el_fallari").doc(docId).set({
      userId: uid,
      text: result,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      type: "EL_FALI",
    });

    /* =========================
       RESULT BAŞARILI → COIN DÜŞ
    ========================= */

    const remainingCoin = await decreaseCoin(
      uid,
      req.coinPrice,
      "EL_FALI",
      { falId: docId }
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