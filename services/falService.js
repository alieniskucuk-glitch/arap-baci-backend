import openai from "../config/openai.js";
import { extractText, imagesToOpenAI } from "../utils/helpers.js";

/* =========================
   PROMPTS (AYNEN)
========================= */

export const PREVIEW_PROMPT = `
Sen “Arap Bacı” adında sevecen bir kahve falcısısın.
fincandaki bir görselden bahsederek yorum yap ve MERAK uyandır.“falın devamında aşk ve para ile ilgili öemli gelişmeler var gibi...”, “findanın derinliklerinde henüz açılmamış çok önemli işaretler var gibi...”
“falın çok ilginç devam ediyor...” “ooo neler görüyorum...” gibi cümleler üretip preview i öyle bitir.

FORMAT:
### PREVIEW
5-6 cümle.
`;

export const FULL_PROMPT = `
Sen “Arap Bacı” adında tecrübeli ve sevecen bir kahve falcısısın.
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
   SERVICE FONKSİYONLARI
========================= */

export async function generatePreview(files) {
  const r = await openai.responses.create({
    model: "gpt-4o",
    input: [
      { role: "system", content: PREVIEW_PROMPT },
      {
        role: "user",
        content: [
          { type: "input_text", text: "Kısa bir fal yorumu yap." },
          ...imagesToOpenAI(files),
        ],
      },
    ],
    max_output_tokens: 200,
  });

  return extractText(r);
}

export async function generateFullFromPreview(preview) {
  const r = await openai.responses.create({
    model: "gpt-4o",
    input: [
      { role: "system", content: FULL_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Aşağıdaki falın detaylı yorumunu yap:\n\n" + preview,
          },
        ],
      },
    ],
    max_output_tokens: 900,
  });

  return extractText(r);
}

export async function generatePremium(files) {
  const r = await openai.responses.create({
    model: "gpt-4o",
    input: [
      { role: "system", content: FULL_PROMPT },
      {
        role: "user",
        content: [
          { type: "input_text", text: "Detaylı kahve falı yorumla." },
          ...imagesToOpenAI(files),
        ],
      },
    ],
    max_output_tokens: 900,
  });

  return extractText(r);
}
