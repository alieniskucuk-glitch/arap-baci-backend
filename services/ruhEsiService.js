import OpenAI from "openai";
import { decreaseCoin } from "../utils/coinManager.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const ruhEsi = async (req, res) => {
  try {
    // 🔥 OPTION FIX
    const option = parseInt(req.body.option, 10);

    if (![1, 2, 3].includes(option)) {
      return res.status(400).json({ error: "Uyum türü belirlenemedi" });
    }

    const { p1Name, p1Birth, p2Name, p2Birth } = req.body;

    let prompt = `
Sen mistik bir ruh uyumu analiz uzmanısın.
Sinastri analizi yaparak, isimlerin numerolojik analizini yaparak ve el çizgilerinin analizini yaparak iki kişinin ruhsal uyumunu değerlendiriyorsun.
0 ile 100 arasında bir uyum yüzdesi üret.
Ardından detaylı ama büyüleyici bir yorum yaz.
Cevabı JSON formatında ver:
{
  "percent": number,
  "result": "yorum metni"
}
`;

    // ================= OPTION 1 =================
    if (option === 1) {
      if (!p1Name || !p1Birth || !p2Name || !p2Birth) {
        return res.status(400).json({ error: "İsim ve doğum tarihleri gerekli" });
      }

      prompt += `
1. Kişi:
İsim: ${p1Name}
Doğum Tarihi: ${p1Birth}

2. Kişi:
İsim: ${p2Name}
Doğum Tarihi: ${p2Birth}
`;
    }

    // ================= OPTION 2 =================
    if (option === 2) {
      if (!req.files?.p1Hand || !req.files?.p2Hand) {
        return res.status(400).json({ error: "İki el fotoğrafı gerekli" });
      }

      prompt += `
Enerji çizgilerine dayalı ruhsal eşleşme analizi yap.
El çizgilerinin uyumuna odaklan.
`;
    }

    // ================= OPTION 3 =================
    if (option === 3) {
      if (!p1Name || !p1Birth || !p2Name || !p2Birth) {
        return res.status(400).json({ error: "İsim ve doğum tarihleri gerekli" });
      }

      if (!req.files?.p1Hand || !req.files?.p2Hand) {
        return res.status(400).json({ error: "İki el fotoğrafı gerekli" });
      }

      prompt += `
1. Kişi:
İsim: ${p1Name}
Doğum Tarihi: ${p1Birth}

2. Kişi:
İsim: ${p2Name}
Doğum Tarihi: ${p2Birth}

El çizgileri + numeroloji + sinastri kombinasyonu ile
derin ruhsal bağ analizi yap.
Daha güçlü ve etkileyici yorum yaz.
`;
    }

    // ================= OPENAI =================

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9,
    });

    const raw = response.choices?.[0]?.message?.content || "";

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        percent: Math.floor(Math.random() * 40) + 60,
        result: raw,
      };
    }

    const percent = Math.min(100, Math.max(0, Number(parsed.percent) || 0));

    // 🔥 Coin düş
    await decreaseCoin(
      req.user.uid,
      req.coinPrice,
      "UYUM",
      { percent }
    );

    return res.status(200).json({
      percent,
      result: parsed.result,
    });

  } catch (err) {
    console.error("RUH ESI ERROR:", err);
    return res.status(500).json({ error: "Uyum analizi yapılamadı" });
  }
};
