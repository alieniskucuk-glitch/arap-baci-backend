import OpenAI from "openai";
import { db } from "../config/firebase.js";
import { decreaseCoin } from "../utils/coinManager.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const ruhEsi = async (req, res) => {
  try {
    const { option, name, birth } = req.body;

    if (!option) {
      return res.status(400).json({ error: "Analiz türü seçilmedi" });
    }

    let prompt = `
Sen mistik bir ruh uyumu analiz uzmanısın.
sinastri analizi yaparak, isimlerin numerolojik analizini yaparak ve el çizgilerinin analizini yaparak iki kişinin ruhsal uyumunu değerlendiriyorsun.
0 ile 100 arasında bir uyum yüzdesi üret.
Ardından detaylı ama büyüleyici bir yorum yaz.
Cevabı JSON formatında ver:
{
  "percent": number,
  "result": "yorum metni"
}
`;

    if (option == 1) {
      if (!name || !birth) {
        return res.status(400).json({ error: "İsim ve doğum tarihi gerekli" });
      }

      prompt += `
İsim: ${name}
Doğum Tarihi: ${birth}
`;
    }

    if (option == 2) {
      prompt += `
Enerji çizgilerine dayalı ruhsal eşleşme analizi yap.
`;
    }

    if (option == 3) {
      prompt += `
Derin ruhsal bağ analizi yap. Daha güçlü ve etkileyici yorum yaz.
`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9,
    });

    const raw = response.choices[0].message.content;

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        percent: Math.floor(Math.random() * 40) + 60,
        result: raw,
      };
    }

    const percent = Math.min(100, Math.max(0, parsed.percent));

    // 🔥 Coin düş
    await decreaseCoin(
      req.user.uid,
      req.coinPrice,
      "UYUM",
      { percent }
    );

    return res.json({
      percent,
      result: parsed.result,
    });

  } catch (err) {
    console.error("RUH ESI ERROR:", err);
    return res.status(500).json({ error: "Uyum analizi yapılamadı" });
  }
};
