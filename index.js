import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import OpenAI from "openai";

dotenv.config();

/* =========================
   APP
========================= */
const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

/* =========================
   UPLOAD
========================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/* =========================
   OPENAI
========================= */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* =========================
   STORES
========================= */
const guestStore = new Map();
const premiumStore = new Map();
const dailyHoroscopeStore = new Map();

/* =========================
   PROMPTS
========================= */
const PREVIEW_PROMPT = `
Sen “Arap Bacı” adında sevecen bir kahve falcısısın.
Sadece MERAK uyandır."falın devamında aşk ve para ile ilgili öemli gelişmeler var gibi...", "findanın derinliklerinde henüz açılmamış çok önemli işaretler var gibi..."
"falın çok ilginç devam ediyor..." "ooo neler görüyorum..." gibi cümleler üretip preview i öyle bitir.

FORMAT:
### PREVIEW
5 kısa cümle.
`;

const FULL_PROMPT = `
Sen “Arap Bacı” adında tecrübeli bir kahve falcısın.
Detaylı ve uzun yaz.

BAŞLIKLAR:
1. Genel Enerji
2. Simgeler
3. Geçmiş
4. Aşk
5. Para / İş
6. Yakın Gelecek
7. Özet
ama başlıkları tazmadan paragraf paragraf anlat.
`;

const DAILY_HOROSCOPE_PROMPT = `
Sen “Arap Bacı” adında tecrübeli bir falcısın.
Sana verilen burca göre SADECE bugüne ait yorum yap.

Kurallar:
- Tek paragraf
- 8-9 cümle
- Aşk, para ve ruh hali mutlaka geçsin
- Kesin konuşma, ihtimalli anlat
- Cinsiyet belirten hiçbir ifade kullanma
- Anaç ama tarafsız, gizemli bir dil kullan
`;

/* =========================
   HELPERS
========================= */
function imagesToOpenAI(files) {
  return files.map((f) => ({
    type: "input_image",
    image_url: `data:image/jpeg;base64,${f.buffer.toString("base64")}`,
  }));
}

function extractText(r) {
  if (typeof r?.output_text === "string") return r.output_text.trim();
  const c = r?.output?.[0]?.content || [];
  return c
    .filter((x) => x.type === "output_text")
    .map((x) => x.text)
    .join("\n")
    .trim();
}

/* =========================
   ROOT
========================= */
app.get("/", (_, res) => {
  res.send("🔮 Arap Bacı Backend OK");
});

/* =====================================================
   GUEST PREVIEW
===================================================== */
app.post("/fal/start", upload.array("images", 3), async (req, res) => {
  if (!req.files?.length) {
    return res.status(400).json({ error: "Fotoğraf gerekli" });
  }

  const id = crypto.randomUUID();
  guestStore.set(id, { status: "processing" });
  res.json({ falId: id });

  (async () => {
    try {
      const r = await openai.responses.create({
        model: "gpt-4.1-mini",
        input: [
          { role: "system", content: PREVIEW_PROMPT },
          {
            role: "user",
            content: [
              { type: "input_text", text: "Kısa bir fal yorumu yap." },
              ...imagesToOpenAI(req.files),
            ],
          },
        ],
        max_output_tokens: 200,
      });

      const preview = extractText(r);
      guestStore.set(id, { status: "done", preview });
    } catch {
      guestStore.set(id, { status: "error" });
    }
  })();
});

app.get("/fal/:id", (req, res) => {
  const f = guestStore.get(req.params.id);
  if (!f) return res.status(404).json({ error: "Bulunamadı" });
  res.json(f);
});

/* =====================================================
   ✅ GUEST FULL (19 TL ÖDEYENLER İÇİN)
===================================================== */
app.post("/fal/complete/:id", async (req, res) => {
  const id = req.params.id;
  const f = guestStore.get(id);

  if (!f || f.status !== "done" || !f.preview) {
    return res.status(404).json({ error: "Fal bulunamadı" });
  }

  // Daha önce üretildiyse tekrar üretme
  if (f.full) {
    return res.json({ full: f.full });
  }

  try {
    const r = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: FULL_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Aşağıdaki falın detaylı yorumunu yap:\n\n" + f.preview,
            },
          ],
        },
      ],
      max_output_tokens: 900,
    });

    const full = extractText(r);
    guestStore.set(id, { ...f, full });

    res.json({ full });
  } catch {
    res.status(500).json({ error: "Fal tamamlanamadı" });
  }
});

/* =====================================================
   PREMIUM (AYNEN KALDI)
===================================================== */
app.post("/fal/premium-start", upload.array("images", 5), async (req, res) => {
  if (!req.files?.length) {
    return res.status(400).json({ error: "Fotoğraf gerekli" });
  }

  const id = crypto.randomUUID();
  premiumStore.set(id, { status: "processing" });
  res.json({ falId: id });

  (async () => {
    try {
      const r = await openai.responses.create({
        model: "gpt-4.1-mini",
        input: [
          { role: "system", content: FULL_PROMPT },
          {
            role: "user",
            content: [
              { type: "input_text", text: "Detaylı kahve falı yorumla." },
              ...imagesToOpenAI(req.files),
            ],
          },
        ],
        max_output_tokens: 900,
      });

      const full = extractText(r);
      premiumStore.set(id, { status: "done", full });
    } catch {
      premiumStore.set(id, { status: "error" });
    }
  })();
});

app.get("/fal/premium/:id", (req, res) => {
  const f = premiumStore.get(req.params.id);
  if (!f) return res.status(404).json({ error: "Bulunamadı" });
  res.json(f);
});

/* =====================================================
   DAILY HOROSCOPE (AYNEN KALDI)
===================================================== */
app.post("/daily-horoscope", async (req, res) => {
  const { zodiac } = req.body;
  if (!zodiac) return res.status(400).json({ error: "Burç gerekli" });

  const today = new Date().toISOString().split("T")[0];
  const key = `${zodiac}-${today}`;

  if (dailyHoroscopeStore.has(key)) {
    return res.json({
      zodiac,
      comment: dailyHoroscopeStore.get(key),
      cached: true,
    });
  }

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
      max_output_tokens: 250,
    });

    const text = extractText(r);
    dailyHoroscopeStore.set(key, text);

    res.json({
      zodiac,
      comment: text,
      cached: false,
    });
  } catch {
    res.status(500).json({ error: "Burç yorumu alınamadı" });
  }
});

/* =========================
   SERVER
========================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("🔮 Arap Bacı backend çalışıyor:", PORT);
});
