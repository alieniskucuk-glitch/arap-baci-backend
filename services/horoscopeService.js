import openai from "../config/openai.js";
import { extractText } from "../utils/helpers.js";

export const DAILY_HOROSCOPE_PROMPT = `
Sen “Arap Bacı” adında tecrübeli bir falcısın.
Sana verilen burca göre SADECE bugüne ait yorum yap.

Kurallar:
- her paragraf en az 10-11 cümle
- Aşk, para ve ruh hali mutlaka geçsin
- Kesin konuşma, ihtimalli anlat
- Cinsiyet belirten hiçbir ifade kullanma
- Anaç ama tarafsız, sevimli fakat gizemli bir dil kullan
`;

/* ================= GENERATE ================= */

export async function generateDailyHoroscope(zodiac) {
  try {
    const r = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: DAILY_HOROSCOPE_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `${zodiac} burcu için bugünün falını yorumla.`,
            },
          ],
        },
      ],
      max_output_tokens: 400, // 🔥 biraz artırıldı (250 yetmiyordu)
    });

    const text = extractText(r);

    // ❗ boş response koruması
    if (!text || text.trim().length === 0) {
      throw new Error("Empty horoscope response");
    }

    return text.trim();

  } catch (err) {
    console.error("generateDailyHoroscope error:", err);
    throw err;
  }
}