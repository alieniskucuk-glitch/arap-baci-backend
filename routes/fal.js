import express from "express";
import multer from "multer";
import crypto from "crypto";

import {
  generatePreview,
  generateFullFromPreview
} from "../services/falService.js";

import auth from "../middleware/auth.js";
import dailyReset from "../middleware/dailyReset.js";
import coinCheck from "../middleware/coinCheck.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const guestStore = new Map();
const premiumStore = new Map();

/* =========================
   /fal/start
========================= */
router.post("/start", upload.array("images", 3), async (req, res) => {
  if (!req.files?.length) {
    return res.status(400).json({ error: "Fotoğraf gerekli" });
  }

  const id = crypto.randomUUID();
  guestStore.set(id, { status: "processing" });
  res.json({ falId: id });

  try {
    const preview = await generatePreview(req.files);
    if (!preview) throw new Error();

    guestStore.set(id, { status: "done", preview });
  } catch {
    guestStore.set(id, { status: "error" });
  }
});

/* =========================
   /fal/:id
========================= */
router.get("/:id", (req, res) => {
  const f = guestStore.get(req.params.id);
  if (!f) return res.status(404).json({ error: "Bulunamadı" });
  res.json(f);
});

/* =========================
   /fal/complete/:id
========================= */
router.post("/complete/:id", async (req, res) => {
  const id = req.params.id;
  const f = guestStore.get(id);

  if (!f || f.status !== "done" || !f.preview) {
    return res.status(404).json({ error: "Fal bulunamadı" });
  }

  if (f.full) {
    return res.json({ full: f.full });
  }

  try {
    const full = await generateFullFromPreview(f.preview);
    guestStore.set(id, { ...f, full });
    res.json({ full });
  } catch {
    res.status(500).json({ error: "Fal tamamlanamadı" });
  }
});

/* =========================
   /fal/premium-start
   🔥 OPENAI DEVRE DIŞI TEST VERSİYON
========================= */
router.post(
  "/premium-start",
  auth,
  upload.array("images", 5),
  dailyReset,
  coinCheck("FAL"),
  async (req, res) => {

    if (!req.files?.length) {
      return res.status(400).json({ error: "Fotoğraf gerekli" });
    }

    const id = crypto.randomUUID();

    premiumStore.set(id, { status: "processing" });

    // 200 hemen dön
    res.status(200).json({ falId: id });

    // 🔥 TEST: 3 saniye sonra done yap
    setTimeout(() => {
      premiumStore.set(id, {
        status: "done",
        full: "TEST FALI ÇALIŞTI ✅"
      });
    }, 3000);
  }
);

/* =========================
   /fal/premium/:id
========================= */
router.get("/premium/:id", (req, res) => {
  const f = premiumStore.get(req.params.id);
  if (!f) return res.status(404).json({ error: "Bulunamadı" });
  res.json(f);
});

export default router;
