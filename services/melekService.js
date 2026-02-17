import { MELEK_DECK } from "../utils/melekDeck.js";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function randomFromRange(min, max, excludeIds = new Set()) {
  const filtered = MELEK_DECK.filter(
    (c) => c.id >= min && c.id <= max && !excludeIds.has(c.id)
  );
  if (!filtered.length) throw new Error("Kart bulunamadı (range/exclude)");
  return filtered[Math.floor(Math.random() * filtered.length)];
}

export async function startMelek(uid, body) {
  const { mode, question } = body;

  let cards = [];
  const used = new Set();

  if (mode === "standard") {
    // 1 kart → 34-54
    const c1 = randomFromRange(34, 54, used);
    used.add(c1.id);
    cards.push(c1);
  }

  if (mode === "deep") {
    // 2 kart → 1. kart 34-54, 2. kart 1-33
    const c1 = randomFromRange(34, 54, used);
    used.add(c1.id);
    const c2 = randomFromRange(1, 33, used);
    used.add(c2.id);

    cards.push(c1, c2);
  }

  if (mode === "zaman") {
    // 3 kart → 1-54 (3'ü de), aynı kart asla yok
    const c1 = randomFromRange(1, 54, used);
    used.add(c1.id);
    const c2 = randomFromRange(1, 54, used);
    used.add(c2.id);
    const c3 = randomFromRange(1, 54, used);
    used.add(c3.id);

    cards.push(c1, c2, c3);
  }

  const interpretation = await generateInterpretation(mode, question, cards);

  // ✅ Coin kuralın: Result GELMEDEN coin düşmez.
  // Coin düşürme işlemini interpretation başarılı olduktan SONRA yapmalısın.
  // (coinManager entegrasyonunu senin mevcut yapına göre birazdan koyarız.)

  return {
    cards: cards.map((c) => ({
      title: c.title,
      image: c.image,
    })),
    interpretation,
  };
}

async function generateInterpretation(mode, question, cards) {
  const cardNames = cards.map((c) => c.title).join(", ");

  const prompt = `
Sen Arap Bacı uygulamasında ilahi rehberlik sunan mistik bir melek kartları yorumcususun.

Mod: ${mode}
Soru: ${question || "Genel rehberlik"}
Kartlar: ${cardNames}

Spiritüel ama net bir yorum yap.
Abartılı dramatik olma.
Kullanıcıya umut ver ama gerçekçi ol.
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return completion.choices[0].message.content;
}
