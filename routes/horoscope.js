import express from "express";
import { generateDailyHoroscope } from "../services/horoscopeService.js";

const router = express.Router();

/* ================= MEMORY CACHE ================= */

const dailyHoroscopeStore = new Map();

/* ================= DATE KEY ================= */

function getTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/* ================= ROUTE ================= */

router.post("/", async (req, res) => {
  try {
    const { zodiac } = req.body;

    if (!zodiac || typeof zodiac !== "string") {
      return res.status(400).json({ error: "Burç gerekli" });
    }

    const today = getTodayKey();
    const key = `${zodiac}-${today}`;

    /* ================= CACHE HIT ================= */

    if (dailyHoroscopeStore.has(key)) {
      return res.json({
        zodiac,
        comment: dailyHoroscopeStore.get(key),
        cached: true,
      });
    }

    /* ================= GENERATE ================= */

    const text = await generateDailyHoroscope(zodiac);

    if (!text || text.trim().length === 0) {
      return res.status(500).json({ error: "Boş yorum döndü" });
    }

    const cleanText = text.trim();

    /* ================= SAVE CACHE ================= */

    dailyHoroscopeStore.set(key, cleanText);

    return res.json({
      zodiac,
      comment: cleanText,
      cached: false,
    });

  } catch (err) {
    console.error("Daily horoscope error:", err);

    return res.status(500).json({
      error: "Burç yorumu alınamadı",
    });
  }
});

export default router;