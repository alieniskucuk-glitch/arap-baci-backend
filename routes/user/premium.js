import express from "express";
import auth from "../../middleware/auth.js";
import { db } from "../../config/firebase.js";

const router = express.Router();

/* =========================
   POST /user/premium
========================= */

router.post("/premium", auth, async (req, res) => {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({ error: "Token gerekli" });
    }

    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    }

    const user = snap.data() || {};

    const now = Date.now();
    const ONE_MONTH = 1000 * 60 * 60 * 24 * 30;

    let newPremiumUntil = now + ONE_MONTH;

    // 🔥 Eğer aktif premium varsa üstüne ekle (stack mantığı)
    if (user.premiumUntil && user.premiumUntil > now) {
      newPremiumUntil = user.premiumUntil + ONE_MONTH;
    }

    await userRef.set(
      {
        isPremium: true,
        premiumUntil: newPremiumUntil,
      },
      { merge: true }
    );

    return res.json({
      success: true,
      isPremium: true,
      premiumUntil: newPremiumUntil,
    });
  } catch (err) {
    console.error("PREMIUM ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;