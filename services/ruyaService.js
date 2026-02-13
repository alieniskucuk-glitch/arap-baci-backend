import OpenAI from "openai";
import { db, admin } from "../config/firebase.js";
import { decreaseCoin } from "../utils/coinManager.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const ruyaYorumla = async (req, res) => {
  try {
    const { dream } = req.body;

    if (!dream || dream.trim().length < 5) {
      return res.status(400).json({ error: "Rüya metni çok kısa" });
    }

    const prompt = `
Sen Arap Bacı adında mistik bir falcısın.
Kullanıcının sana anlattığı rüyasını yorumluyorsun.

Rüya:
"${dream}"

Yorumu:
- Psikolojik anlamı
- Sembolik anlamı
- Yakın gelecek mesajı
- Geçmişle bağlantısı
- Genel tavsiyeler

Samimi, sıcak ve gizemli bir dil kullan.
    `;

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    });

    const result =
      response.output_text ||
      "Rüyanda güçlü bir mesaj var ama biraz daha dikkatle düşünmelisin...";

    const docId = `${req.user.uid}_ruya_${Date.now()}`;

    // 🔮 Firestore kaydı
    await db.collection("ruya_yorumlari").doc(docId).set({
      userId: req.user.uid,
      text: result,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      type: "RUYA",
    });

    // 💰 Coin düş
    await decreaseCoin(
      req.user.uid,
      req.coinPrice,
      "RUYA",
      { ruyaId: docId }
    );

    return res.json({
      success: true,
      result,
    });

  } catch (err) {
    console.error("RUYA ERROR:", err);
    return res.status(500).json({
      error: "Rüya yorumlanamadı",
    });
  }
};
