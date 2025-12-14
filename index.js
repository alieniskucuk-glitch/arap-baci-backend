import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

/* =========================
   APP & MIDDLEWARE
========================= */
const app = express();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json());

/* =========================
   OPENAI CLIENT
========================= */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* =========================
   PROMPT
========================= */
const ARAP_BACI_PROMPT = `
Sen “Arap Bacı” adında, yaşı ilerlemiş, sevecen, tatlı dilli,
mahalle kültüründen gelen, mistik bir kahve falcısı teyzesin.

Konuşma tarzın:
- Sempatik ve sıcak
- Sevecen, şefkatli
- Hafif nasihat veren
- “Kızım”, “canım”, “evladım” gibi hitaplar kullanırsın
- Geleneksel halk diliyle konuşursun
- Asla modern, teknik veya yapay konuşmazsın

Kullanıcı sana kahve fincanı fotoğrafları gönderir.
Bu fotoğraflara gerçekten bakıyormuş gibi davranırsın.
Fincanın içindeki izleri, akıntıları, gölgeleri ve şekilleri
gerçekten görmüş gibi “simgeler” olarak yorumlarsın.

GENEL KURALLAR:
- Fal dili tamamen Türkçe olacak
- Asla yapay zekâ olduğunu söyleme
- Korkutma (ölüm, hastalık, felaket yok)
- Umut veren ama gizemini koruyan bir ton kullan
- Fotoğraf sayısı arttıkça yorum DAHA UZUN ve DETAYLI olsun
- Her fotoğraftan en az bir simge çıkar
- Okuyan kişiye kendini özel hissettir

FORMAT KURALLARI:

### PREVIEW
- 1 paragraf
- 1 ana simge
- Yarım bırak, merak uyandır

### FULL
1. Genel enerji
2. Görülen simgeler
3. Aşk
4. Para / iş
5. Yakın gelecek ve nasihat
`;

/* =========================
   ROUTES
========================= */

// Health check
app.get("/", (req, res) => {
  res.send("Arap Bacı Backend Çalışıyor 🔮");
});

// Fal endpoint
app.post("/fal", upload.array("images", 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Fotoğraf gerekli" });
    }

    const userContent = [
      {
        type: "input_text",
        text: "Bu fotoğraflara bakarak kahve falımı yorumla.",
      },
      ...req.files.map((file) => ({
        type: "input_image",
        image_url: `data:${file.mimetype};base64,${file.buffer.toString(
          "base64"
        )}`,
      })),
    ];

    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: [
        { role: "system", content: ARAP_BACI_PROMPT },
        { role: "user", content: userContent },
      ],
    });

    // ✅ GÜVENLİ TEXT PARSE
    let text = "";

    try {
      text = response.output[0].content
        .filter((c) => c.type === "output_text")
        .map((c) => c.text)
        .join("\n");
    } catch (e) {
      console.error("TEXT PARSE ERROR:", e);
    }

    if (!text) {
      return res.status(500).json({
        error: "Fal üretilemedi",
        detail: "OpenAI boş cevap döndürdü",
      });
    }

    const preview = text
      .split("### FULL")[0]
      .replace("### PREVIEW", "")
      .trim();

    const full = text.includes("### FULL")
      ? text.split("### FULL")[1].trim()
      : "";

    res.json({ preview, full });
  } catch (err) {
    console.error("OPENAI ERROR 👉", err);

    res.status(500).json({
      error: "Fal üretilemedi",
      detail: err?.message || "Bilinmeyen hata",
    });
  }
});

/* =========================
   SERVER
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🔮 Backend çalışıyor, port:", PORT);
});
