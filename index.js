import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import OpenAI from "openai";
import admin from "firebase-admin";

dotenv.config();

/* =========================
   APP
========================= */
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

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
   FIREBASE (OPSİYONEL AMA HAZIR)
========================= */
const firebaseEnabled = !!process.env.FIREBASE_SERVICE_ACCOUNT;

if (firebaseEnabled && !admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  });
}

/* =========================
   TEMP STORE (GUEST)
========================= */
const falStore = new Map();

/* =========================
   ARAP BACI PROMPT
========================= */
const ARAP_BACI_PROMPT = `
Sen “Arap Bacı” adında, yaşı ilerlemiş, sevecen,
mahalle kültüründen gelen bir kahve falcısısın.

Kurallar:
- Türkçe konuş
- Umut ver
- Cinsiyet belirtme
- Korkutma
- Kesin hükümler verme

FORMAT:

### PREVIEW
4 cümle, merak uyandırıcı

### FULL
1. Genel enerji
2. Simgeler
3. Geçmiş
4. Aşk
5. Para / iş
6. Yakın gelecek
7. Özet
`;

/* =========================
   HELPERS
========================= */
function imagesToOpenAI(files) {
  return files.map((file) => ({
    type: "input_image",
    image_url: `data:image/jpeg;base64,${file.buffer.toString("base64")}`,
  }));
}

function extractPreview(text) {
  const parts = text.split("### FULL");
  return parts[0].replace("### PREVIEW", "").trim();
}

/* =========================
   ROOT
========================= */
app.get("/", (_, res) => {
  res.send("🔮 Arap Bacı Backend Çalışıyor");
});

/* =========================
   GUEST FAL
========================= */
app.post("/fal/guest-start", upload.array("images", 3), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "Fotoğraf gerekli" });
  }

  const falId = crypto.randomUUID();
  falStore.set(falId, { status: "processing" });
  res.json({ falId });

  (async () => {
    try {
      const userContent = [
        { type: "input_text", text: "Bu fincan fotoğraflarına bakarak falımı yorumla." },
        ...imagesToOpenAI(req.files),
      ];

      const response = await openai.responses.create({
        model: "gpt-4.1-mini",
        input: [
          { role: "system", content: ARAP_BACI_PROMPT },
          { role: "user", content: userContent },
        ],
        max_output_tokens: 450,
      });

      const text = (response.output?.[0]?.content || [])
        .filter((c) => c.type === "output_text")
        .map((c) => c.text)
        .join("\n");

      falStore.set(falId, {
        status: "done",
        preview: extractPreview(text),
      });
    } catch (err) {
      console.error("GUEST FAL ERROR:", err);
      falStore.set(falId, { status: "error" });
    }
  })();
});

/* =========================
   GET RESULT (GUEST & PREMIUM)
========================= */
app.get("/fal/:id", (req, res) => {
  const fal = falStore.get(req.params.id);
  if (!fal) return res.status(404).json({ error: "Fal bulunamadı" });
  res.json(fal);
});

/* =========================
   SERVER
========================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("🔮 Arap Bacı backend çalışıyor, port:", PORT);
});
