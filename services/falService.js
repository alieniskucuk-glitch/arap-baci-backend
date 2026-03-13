import openai from "../config/openai.js";
import { extractText, imagesToOpenAI } from "../utils/helpers.js";
import { db } from "../config/firebase.js";

/* =========================
   PROMPTS (AYNEN)
========================= */

export const PREVIEW_PROMPT = `
Sen “Arap Bacı” adında sevecen ve mistik bir kahve falcısısın.
fincandaki bir görselden bahsederek yorum yap ve MERAK uyandır.“falın devamında aşk ve para ile ilgili öemli gelişmeler var gibi...”, “findanın derinliklerinde henüz açılmamış çok önemli işaretler var gibi...”
“falın çok ilginç devam ediyor...” “ooo neler görüyorum...” gibi cümleler üretip preview i öyle bitir.

FORMAT:
### PREVIEW
5-6 cümle.
`;

export const FULL_PROMPT = `
Sen “Arap Bacı” adında tecrübeli, mistik ve sevecen bir kahve falcısısın.
fincandaki imgelere göre Detaylı ve uzun bir fal yaz.sevimli tonton bir dil kullan ve kesinlikle cinsiyet belirten ifadelerden kaçın.
Fala kullanıcının ismi varsa ismiyle hitap ederek başla ve fal içinde uzunluğuna göre 2-4 kez ismini kullan.
Eğer kullanıcı ismi verilmemişse isimsiz şekilde doğal bir fal yorumu yap ve isim kullanma.

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

export async function generatePreview(files, uid) {

  const userDoc = await db.collection("users").doc(uid).get();
  const name = (userDoc.data()?.name || "").trim();

  const r = await openai.responses.create({
    model: "gpt-4o",
    temperature: 0.85,
    input: [
      { role: "system", content: PREVIEW_PROMPT },
      {
        role: "user",
        content: [
          { type: "input_text", text: `${name} için kısa bir fal yorumu yap.` },
          ...imagesToOpenAI(files),
        ],
      },
    ],
    max_output_tokens: 280,
  });

  return extractText(r);
}

export async function generateFullFromPreview(preview, uid) {

  const userDoc = await db.collection("users").doc(uid).get();
  const name = userDoc.data()?.name || "";

  const r = await openai.responses.create({
    model: "gpt-4o",
    temperature: 0.85,
    input: [
      { role: "system", content: FULL_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `${name} için aşağıdaki falın uzun ve detaylı yorumunu yap:\n\n` + preview,
          },
        ],
      },
    ],
    max_output_tokens: 1100,
  });

  return extractText(r);
}

export async function generatePremium(files, uid) {

  const userDoc = await db.collection("users").doc(uid).get();
  const name = userDoc.data()?.name || "";

  const r = await openai.responses.create({
    model: "gpt-4o",
    temperature: 0.85,
    input: [
      { role: "system", content: FULL_PROMPT },
      {
        role: "user",
        content: [
          { type: "input_text", text: `${name} için detaylı ve uzun kahve falı yorumla.` },
          ...imagesToOpenAI(files),
        ],
      },
    ],
    max_output_tokens: 1200,
  });

  return extractText(r);
}