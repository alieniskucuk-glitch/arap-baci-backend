import express from "express";
import { generateDailyHoroscope } from "../services/horoscopeService.js";

const router = express.Router();
const dailyHoroscopeStore = new Map();

router.post("/", async (req, res) => {
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
    const text = await generateDailyHoroscope(zodiac);
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

export default router;
