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
   PROMPTS  (BİREBİR)
========================= */
const PREVIEW_PROMPT = `
Sen “Arap Bacı” adında sevecen bir kahve falcısısın.
fincandaki bir görselden bahsederek yorum yap ve MERAK uyandır.“falın devamında aşk ve para ile ilgili öemli gelişmeler var gibi...”, “findanın derinliklerinde henüz açılmamış çok önemli işaretler var gibi...”
“falın çok ilginç devam ediyor...” “ooo neler görüyorum...” gibi cümleler üretip preview i öyle bitir.

FORMAT:
### PREVIEW
5-6 cümle.
`;

const FULL_PROMPT = `
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

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

function normQuota(q) {
  return {
    packRemaining: Number(q?.packRemaining || 0),
    dailyRemaining: Number(q?.dailyRemaining || 0),
    dailyLastDay: (q?.dailyLastDay || "").toString(),
    totalUsed: Number(q?.totalUsed || 0),
  };
}

/* =========================
   ROOT
========================= */
app.get("/", (_, res) => {
  res.send("🔮 Arap Bacı Backend OK");
});

/* =====================================================
   USER QUOTA  ✅ (SORUN BURADAYDI)
===================================================== */
app.get("/user/quota", async (req, res) => {
  const uid = req.headers["x-uid"];
  if (!uid) return res.status(401).json({ error: "uid yok" });

  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    return res.json({
      packRemaining: 0,
      dailyRemaining: 0,
      totalUsed: 0,
      remaining: 0,
    });
  }

  const data = snap.data();
  const isPremium = data?.isPremium === true;

  const q = normQuota(data?.quota);
  const today = todayKey();

  // daily reset
  if (q.dailyLastDay !== today) {
    q.dailyLastDay = today;
    q.dailyRemaining = isPremium ? 1 : 0;

    await ref.set(
      {
        quota: {
          ...data.quota,
          dailyLastDay: q.dailyLastDay,
          dailyRemaining: q.dailyRemaining,
          packRemaining: q.packRemaining,
          totalUsed: q.totalUsed,
        },
      },
      { merge: true }
    );
  }

  // 🔑 GERİYE UYUMLULUK
  const remaining = isPremium ? q.dailyRemaining : q.packRemaining;

  res.json({
    packRemaining: q.packRemaining,
    dailyRemaining: q.dailyRemaining,
    totalUsed: q.totalUsed,
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
    const data = snap.data();
    const q = normQuota(data?.quota);

    tx.set(
      ref,
      {
        quota: {
          ...data.quota,
          packRemaining: q.packRemaining + add,
          dailyRemaining: q.dailyRemaining,
          dailyLastDay: q.dailyLastDay,
          totalUsed: q.totalUsed,
        },
      },
      { merge: true }
    );
  });

  res.json({ ok: true });
});

/* =====================================================
   QUOTA USE
===================================================== */
app.post("/quota/use", async (req, res) => {
  const uid = req.headers["x-uid"];
  if (!uid) return res.status(401).json({ error: "uid yok" });

  const ref = db.collection("users").doc(uid);

  try {
    const out = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data();
      const isPremium = data?.isPremium === true;

      const today = todayKey();
      const q = normQuota(data?.quota);

      if (q.dailyLastDay !== today) {
        q.dailyLastDay = today;
        q.dailyRemaining = isPremium ? 1 : 0;
      }

      if (isPremium && q.dailyRemaining > 0) {
        q.dailyRemaining -= 1;
      } else if (q.packRemaining > 0) {
        q.packRemaining -= 1;
      } else {
        return { code: 403, body: { error: "Hak yok" } };
      }

      q.totalUsed += 1;

      tx.set(
        ref,
        {
          quota: {
            ...data.quota,
            packRemaining: q.packRemaining,
            dailyRemaining: q.dailyRemaining,
            dailyLastDay: q.dailyLastDay,
            totalUsed: q.totalUsed,
          },
        },
        { merge: true }
      );

      return { code: 200, body: { ok: true } };
    });

    res.status(out.code).json(out.body);
  } catch {
    res.status(500).json({ error: "quota failed" });
  }
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
   PREMIUM START
===================================================== */
app.post("/fal/premium-start", upload.array("images", 5), async (req, res) => {
  const uid = req.headers["x-uid"];
  if (!uid) return res.status(401).json({ error: "uid yok" });

  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.isPremium !== true)
    return res.status(403).json({ error: "Premium değil" });

  const q = normQuota(snap.data()?.quota);
  const today = todayKey();

  if (q.dailyLastDay !== today && q.dailyRemaining <= 0)
    return res.status(403).json({ error: "Bugünlük hak bitti" });

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

/* =====================================================
   SERVER
===================================================== */
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("🔮 Arap Bacı backend çalışıyor:", PORT);
});
