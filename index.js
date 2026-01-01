import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import OpenAI from "openai";
import admin from "firebase-admin";
import fs from "fs";

dotenv.config();

/* =========================
   FIREBASE ADMIN
========================= */
const serviceAccount = JSON.parse(
  fs.readFileSync("./firebase/serviceAccount.json", "utf8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

/* =========================
   APP
========================= */
const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

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
   TEMP STORE
========================= */
const falStore = new Map();

/* =========================
   PROMPT
========================= */
const ARAP_BACI_PROMPT = `
Sen “Arap Bacı” adında, yaşı ilerlemiş, sevecen,
mahalle kültüründen gelen bir kahve falcısısın.

Kurallar:
- Türkçe konuş
- Umut ver
- Cinsiyet belirtme
- Korkutma

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
function toImagesContent(files) {
  return files.map((file) => ({
    type: "input_image",
    image_url: `data:image/jpeg;base64,${file.buffer.toString("base64")}`,
  }));
}

function extractPreviewAndFull(text) {
  const parts = text.split("### FULL");
  const preview = parts[0].replace("### PREVIEW", "").trim();
  const full = parts[1] ? parts[1].trim() : null;
  return { preview, full };
}

/* =========================
   HEALTH
========================= */
app.get("/", (_, res) => {
  res.send("🔮 Arap Bacı Backend Çalışıyor");
});

/* =========================
   GUEST FAL
========================= */
app.post("/fal/guest-start", upload.array("images", 3), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Fotoğraf gerekli" });
    }

    const falId = crypto.randomUUID();
    falStore.set(falId, { status: "processing" });
    res.json({ falId });

    (async () => {
      try {
        const userContent = [
          { type: "input_text", text: "Bu fotoğraflara bakarak kahve falımı yorumla." },
          ...toImagesContent(req.files),
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

        const { preview } = extractPreviewAndFull(text);

        falStore.set(falId, {
          status: "done",
          preview,
          full: null,
        });
      } catch (err) {
        console.error("FAL ERROR (guest):", err);
        falStore.set(falId, { status: "error" });
      }
    })();
  } catch (err) {
    console.error("SERVER ERROR (guest):", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

/* =========================
   GET RESULT
========================= */
app.get("/fal/:id", (req, res) => {
  const fal = falStore.get(req.params.id);
  if (!fal) return res.status(404).json({ error: "Fal bulunamadı" });
  res.json(fal);
});

/* =========================
   SERVER (RENDER)
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🔮 Backend çalışıyor, port:", PORT);
});

