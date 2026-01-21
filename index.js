import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import OpenAI from "openai";
import admin from "firebase-admin";

dotenv.config();

/* =========================
   FIREBASE ADMIN
========================= */
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});
const db = admin.firestore();

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

// 🧠 RAM cache (daily horoscope)
const dailyCache = new Map(); // key: YYYY-MM-DD_zodiac

/* =========================
   PROMPTS
========================= */
const PREVIEW_PROMPT = `
Sen “Arap Bacı” adında sevecen bir kahve falcısısın.
Sadece MERAK uyandır.

FORMAT:
### PREVIEW
4 kısa cümle.
`;

const FULL_PROMPT = `
Sen “Arap Bacı” adında tecrübeli bir kahve falcısısın.
Detaylı ve uzun yaz.

BAŞLIKLAR:
1. Genel Enerji
2. Simgeler
3. Geçmiş
4. Aşk
5. Para / İş
6. Yakın Gelecek
7. Özet
`;

const DAILY_HOROSCOPE_PROMPT = `
Sen “Arap Bacı” adında tecrübeli bir falcısın.
Sana verilen burca göre SADECE bugüne ait yorum yap.

Kurallar:
- Tek paragraf
- 6–8 cümle
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

function todayKey(zodiac) {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${date}_${zodiac}`;
}

/* =========================
   ROOT
========================= */
app.get("/", (_, res) => {
  res.send("🔮 Arap Bacı Backend OK");
});

/* =====================================================
   GUEST
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

      guestStore.set(id, {
        status: "done",
        preview: extractText(r),
      });
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
   PREMIUM
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

      premiumStore.set(id, {
        status: "done",
        full: extractText(r),
      });
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
   DAILY HOROSCOPE (RAM + FIRESTORE CACHE)
===================================================== */
app.post("/daily-horoscope", async (req, res) => {
  try {
    const { zodiac } = req.body;
    if (!zodiac) {
      return res.status(400).json({ error: "Burç gerekli" });
    }

    const key = todayKey(zodiac);

    // 1️⃣ RAM CACHE
    if (dailyCache.has(key)) {
      return res.json({
        zodiac,
        comment: dailyCache.get(key),
        source: "memory",
      });
    }

    // 2️⃣ FIRESTORE CACHE
    const docRef = db.collection("daily_horoscopes").doc(key);
    const snap = await docRef.get();

    if (snap.exists) {
      const comment = snap.data().comment;
      dailyCache.set(key, comment);

      return res.json({
        zodiac,
        comment,
        source: "firestore",
      });
    }

    // 3️⃣ OPENAI (İLK KEZ)
    const r = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: DAILY_HOROSCOPE_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `${zodiac} burcu için bugünün yorumunu yap.`,
            },
          ],
        },
      ],
      max_output_tokens: 250,
    });

    const comment = extractText(r);

    // cache yaz
    dailyCache.set(key, comment);
    await docRef.set({
      zodiac,
      date: key.split("_")[0],
      comment,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      zodiac,
      comment,
      source: "openai",
    });
  } catch (e) {
    console.error("daily-horoscope error:", e);
    res.status(500).json({ error: "Burç yorumu alınamadı" });
  }
});

/* =========================
   DAILY CACHE RESET (00:00)
========================= */
function scheduleDailyCacheReset() {
  function msUntilMidnight() {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    return midnight.getTime() - now.getTime();
  }

  setTimeout(() => {
    dailyCache.clear();
    console.log("🧹 Daily horoscope RAM cache temizlendi");

    setInterval(() => {
      dailyCache.clear();
      console.log("🧹 Daily horoscope RAM cache temizlendi");
    }, 24 * 60 * 60 * 1000);
  }, msUntilMidnight());
}

scheduleDailyCacheReset();

/* =========================
   SERVER
========================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("🔮 Arap Bacı backend çalışıyor:", PORT);
});
