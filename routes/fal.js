import express from "express";
import multer from "multer";
import crypto from "crypto";

import {
  generatePreview,
  generateFullFromPreview,
  generatePremium
} from "../services/falService.js";

import auth from "../middleware/auth.js";
import coinCheck from "../middleware/coinCheck.js";
import { decreaseCoin } from "../utils/coinManager.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const guestStore = new Map();
const premiumStore = new Map();

/* =========================
   GUEST START
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
   GUEST COMPLETE
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
   PREMIUM START
========================= */

router.post(
  "/premium-start",
  auth,
  upload.array("images", 5),
  coinCheck("FAL"),
  async (req, res) => {
    try {
      if (!req.files?.length) {
        return res.status(400).json({ error: "Fotoğraf gerekli" });
      }

      const uid = req.user.uid;
      const price = req.coinPrice;
      const id = crypto.randomUUID();

      premiumStore.set(id, { status: "processing" });

      // Hemen falId dön
      res.status(200).json({ falId: id });

      /* =========================
         GPT ÜRETİMİ
      ========================= */

      const full = await generatePremium(req.files);

      if (!full) {
        throw new Error("Fal boş geldi");
      }

      /* =========================
         RESULT BAŞARILI → COIN DÜŞ
      ========================= */

      await decreaseCoin(uid, price, "FAL", {
        falId: id,
      });

      premiumStore.set(id, { status: "done", full });

    } catch (err) {
      console.error("PREMIUM ERROR:", err);
      premiumStore.set(id, { status: "error" });
    }
  }
);

/* =========================
   PREMIUM POLLING
========================= */

router.get("/premium/:id", (req, res) => {
  const f = premiumStore.get(req.params.id);
  if (!f) return res.status(404).json({ error: "Bulunamadı" });
  res.json(f);
});

export default router;