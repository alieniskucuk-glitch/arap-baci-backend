import { MELEK_DECK } from "../utils/melekDeck.js";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function randomFromRange(min, max) {
  const filtered = MELEK_DECK.filter(c => c.id >= min && c.id <= max);
  return filtered[Math.floor(Math.random() * filtered.length)];
}

export async function startMelek(uid, body) {
  const { mode, question } = body;

  let cards = [];

  if (mode === "standard") {
    cards.push(randomFromRange(34, 54));
  }

  if (mode === "deep") {
    cards.push(randomFromRange(34, 54));
    cards.push(randomFromRange(1, 33));
  }

  if (mode === "zaman") {
    cards.push(randomFromRange(1, 54));
    cards.push(randomFromRange(1, 54));
    cards.push(randomFromRange(1, 54));
  }

  const interpretation = await generateInterpretation(mode, question, cards);

  return {
    cards: cards.map(c => ({
      title: c.title,
      image: c.image
    })),
    interpretation
  };
}

async function generateInterpretation(mode, question, cards) {
  const cardNames = cards.map(c => c.title).join(", ");

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
