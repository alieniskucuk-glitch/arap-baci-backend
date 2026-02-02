import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import OpenAI from "openai";
import admin from "firebase-admin";

dotenv.config();

/* =========================
   FIREBASE
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
const dailyHoroscopeStore = new Map();

/* =========================
   PROMPTS (BİREBİR)
========================= */
const PREVIEW_PROMPT = `
Sen “Arap Bacı” adında sevecen bir kahve falcısısın.
fincandaki bir görselden bahsederek yorum yap ve MERAK uyandır.
“falın devamında aşk ve para ile ilgili önemli gelişmeler var gibi...”
“fincanın derinliklerinde henüz açılmamış çok önemli işaretler var gibi...”
“falın çok ilginç devam ediyor...”
“ooo neler görüyorum...”
gibi cümlelerle preview’i bitir.

FORMAT:
### PREVIEW
5-6 cümle.
`;

const FULL_PROMPT = `
Sen “Arap Bacı” adında tecrübeli ve sevecen bir kahve falcısısın.
Fincandaki imgelere göre detaylı ve uzun bir fal yaz.
Sevimli tonton bir dil kullan ama cinsiyet belirten ifadelerden kaçın.
Gördüğün imgelerden bahset.

BAŞLIKLAR:
1. Genel Enerji
2. Simgeler
3. Geçmiş
4. Aşk
5. Para / İş
6. Yakın Gelecek
7. Özet
Ama başlık yazmadan paragraf paragraf anlat.
`;

const DAILY_HOROSCOPE_PROMPT = `
Sen “Arap Bacı” adında tecrübeli bir falcısın.
Sana verilen burca göre SADECE bugüne ait yorum yap.

Kurallar:
- Tek paragraf
- 8-9 cümle
- Aşk, para ve ruh hali mutlaka geçsin
- Kesin konuşma, ihtimalli anlat
- Cinsiyet belirten ifade kullanma
- Gizemli ama anaç bir dil
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

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

/* =========================
   ROOT
========================= */
app.get("/", (_, res) => {
  res.send("🔮 Arap Bacı Backend OK");
});

/* =====================================================
   USER QUOTA (TEK RESET NOKTASI)
===================================================== */
app.get("/user/quota", async (req, res) => {
  const uid = req.headers["x-uid"];
  if (!uid) return res.status(401).json({ error: "uid yok" });

  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    return res.json({
      dailyRemaining: 0,
      packRemaining: 0,
      totalUsed: 0,
      remaining: 0,
    });
  }

  const data = snap.data();
  const isPremium = data?.isPremium === true;

  let {
    dailyLastDay = "",
    dailyRemaining = 0,
    packRemaining = 0,
    totalUsed = 0,
  } = data.quota || {};

  const today = todayKey();

  // ✅ DAILY RESET SADECE BURADA
  if (dailyLastDay !== today) {
    dailyLastDay = today;
    dailyRemaining = isPremium ? 1 : 0;

    await ref.set(
      {
        quota: {
          ...data.quota,
          dailyLastDay,
          dailyRemaining,
          packRemaining,
          totalUsed,
        },
      },
      { merge: true }
    );
  }

  const remaining = isPremium ? dailyRemaining : packRemaining;

  res.json({
    dailyRemaining,
    packRemaining,
    totalUsed,
    remaining,
  });
});

/* =====================================================
   PACKAGE SUCCESS
===================================================== */
const PACKAGE_MAP = {
  single: 1,
  pack5: 5,
  pack10: 10,
  pack15: 15,
  pack30: 30,
};

app.post("/payment/package-success", async (req, res) => {
  const { uid, packageType } = req.body;
  const add = PACKAGE_MAP[packageType];
  if (!uid || !add) return res.status(400).json({ error: "Geçersiz istek" });

  const ref = db.collection("users").doc(uid);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("user yok");

    const data = snap.data();
    const q = data.quota || {};

    tx.set(
      ref,
      {
        quota: {
          ...q,
          packRemaining: (q.packRemaining || 0) + add,
        },
      },
      { merge: true }
    );
  });

  res.json({ ok: true });
});

/* =====================================================
   QUOTA USE (RESULT AÇILINCA)
===================================================== */
app.post("/quota/use", async (req, res) => {
  const uid = req.headers["x-uid"];
  if (!uid) return res.status(401).json({ error: "uid yok" });

  const ref = db.collection("users").doc(uid);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("user yok");

    const data = snap.data();
    const isPremium = data.isPremium === true;

    let {
      dailyRemaining = 0,
      packRemaining = 0,
      totalUsed = 0,
    } = data.quota || {};

    if (isPremium && dailyRemaining > 0) {
      dailyRemaining -= 1;
    } else if (packRemaining > 0) {
      packRemaining -= 1;
    } else {
      throw new Error("hak yok");
    }

    totalUsed += 1;

    tx.set(
      ref,
      {
        quota: {
          ...data.quota,
          dailyRemaining,
          packRemaining,
          totalUsed,
        },
      },
      { merge: true }
    );
  });

  res.json({ ok: true });
});

/* =====================================================
   GUEST PREVIEW
===================================================== */
app.post("/fal/start", upload.array("images", 3), async (req, res) => {
  if (!req.files?.length)
    return res.status(400).json({ error: "Fotoğraf gerekli" });

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
        max_output_tokens: 260,
      });

      guestStore.set(id, { status: "done", preview: extractText(r) });
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
   GUEST FULL
===================================================== */
app.post("/fal/complete/:id", async (req, res) => {
  const f = guestStore.get(req.params.id);
  if (!f || !f.preview) return res.status(404).json({ error: "Fal yok" });

  if (f.full) return res.json({ full: f.full });

  try {
    const r = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: FULL_PROMPT },
        { role: "user", content: f.preview },
      ],
      max_output_tokens: 950,
    });

    const full = extractText(r);
    guestStore.set(req.params.id, { ...f, full });
    res.json({ full });
  } catch {
    res.status(500).json({ error: "Tamamlanamadı" });
  }
});

/* =====================================================
   PREMIUM START (HAK DÜŞMEZ)
===================================================== */
app.post("/fal/premium-start", upload.array("images", 5), async (req, res) => {
  const uid = req.headers["x-uid"];
  if (!uid) return res.status(401).json({ error: "uid yok" });

  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();

  if (!snap.exists || snap.data()?.isPremium !== true) {
    return res.status(403).json({ error: "Premium değil" });
  }

  const { dailyRemaining = 0 } = snap.data().quota || {};

  if (dailyRemaining <= 0) {
    return res.status(403).json({ error: "Bugünlük hak bitti" });
  }

  if (!req.files?.length)
    return res.status(400).json({ error: "Fotoğraf gerekli" });

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
              { type: "input_text", text: "Detaylı fal yorumu." },
              ...imagesToOpenAI(req.files),
            ],
          },
        ],
        max_output_tokens: 950,
      });

      premiumStore.set(id, { status: "done", full: extractText(r) });
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

/* =========================
   SERVER
========================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("🔮 Arap Bacı backend çalışıyor:", PORT);
});
