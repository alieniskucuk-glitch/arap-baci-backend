import openai from "../config/openai.js";
import { extractText, imagesToOpenAI } from "../utils/helpers.js";

/* =========================
   PROMPTS (KORUNDU)
========================= */

export const FULL_PROMPT = `
Sen “Arap Bacı” adında tecrübeli, mistik ve sevecen bir kahve falcısısın.
fincandaki imgelere göre Detaylı ve uzun bir fal yaz.sevimli tonton bir dil kullan ama kesinlikle cinsiyet belirten ifadelerden kaçın.
falı yorumlarken gördüğün imgelerden de bahset.

BAŞLIKLAR:
1. Genel Enerji
2. Simgeler
3. Geçmiş
4. Aşk
5. Para / İş
6. Yakın Gelecek
7. Özet
ama başlıkları yazmadan paragraf paragraf anlat.
`;

/* =========================
   TEK SERVICE
========================= */

export async function generateFal(files) {
  const r = await openai.responses.create({
    model: "gpt-4o",
    temperature: 0.85,
    input: [
      { role: "system", content: FULL_PROMPT },
      {
        role: "user",
        content: [
          { type: "input_text", text: "Detaylı ve uzun kahve falı yorumla." },
          ...imagesToOpenAI(files),
        ],
      },
    ],
    max_output_tokens: 1200,
  });

  return extractText(r);
}