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

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "Sen Arap Bacı adında mistik bir cingene el falcısısın. Samimi, gizemli ve sıcak bir dille konuş.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Bu bir el falı. Avuç içindeki çizgilere bakarak kişilik, aşk, para ve yakın gelecek hakkında yorum yap.Yorum yaparken eldeki çizgilerden, uzunluğundan, kısalığından falan bahsedebilirsin.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 600,
    });

    const result =
      completion.choices[0]?.message?.content ||
      "Elinde güçlü bir enerji hissediyorum…";

    const docId = `${req.user.uid}_el_${Date.now()}`;

    await db.collection("el_fallari").doc(docId).set({
      userId: req.user.uid,
      text: result,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      type: "EL_FALI",
    });

    await decreaseCoin(
      req.user.uid,
      req.coinPrice,
      "EL_FALI",
      { falId: docId }
    );

    res.json({
      success: true,
      result,
    });

  } catch (err) {
    console.error("EL FALI HATA:", err);
    res.status(500).json({ error: "El falı yorumlanamadı" });
  }
};
