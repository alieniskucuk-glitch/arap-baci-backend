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

    const prompt = `
Sen Arap Bacısın.
Bu bir el falı.
Avuç içindeki çizgilere bakarak
kişilik, aşk, para ve yakın gelecek hakkında yorum yap.
Samimi, gizemli ve sıcak bir dil kullan.
    `;

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            {
              type: "input_image",
              image_base64: base64Image,
            },
          ],
        },
      ],
    });

    const result =
      response.output_text || "Elinde güçlü bir enerji hissediyorum…";

    const docId = `${req.user.uid}_el_${Date.now()}`;

    /* =========================
       1️⃣ Fal kaydı
    ========================= */
    await db.collection("el_fallari").doc(docId).set({
      userId: req.user.uid,
      text: result,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      type: "EL_FALI",
    });

    /* =========================
       2️⃣ Coin düş (MERKEZİ)
    ========================= */
    await decreaseCoin(
      req.user.uid,
      req.coinPrice,
      "EL_FALI",
      { falId: docId }
    );

    /* =========================
       3️⃣ Response
    ========================= */
    res.json({
      success: true,
      result,
    });

  } catch (err) {
    console.error("EL FALI HATA:", err);

    if (err.message === "Yetersiz coin") {
      return res.status(400).json({ error: "Yetersiz coin" });
    }

    res.status(500).json({ error: "El falı yorumlanamadı" });
  }
};
