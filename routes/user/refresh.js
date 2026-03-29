import express from "express";
import auth from "../../middleware/auth.js";
import dailyReset from "../../middleware/dailyReset.js";
import { db } from "../../config/firebase.js";

const router = express.Router();

/* =========================
   POST /user/refresh
========================= */

router.post("/refresh", auth, dailyReset, async (req, res) => {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({ error: "Token gerekli" });
    }

    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();

    // 🔥 USER YOKSA OTOMATİK OLUŞTUR (CRITICAL FIX)
    if (!snap.exists) {
      await userRef.set({
        uid,
        createdAt: new Date(),
        profileCompleted: false,
        isPremium: false,
        zodiac: null,
        abCoin: 0,
        dailyCoin: 0,
      });

      return res.json({
        isPremium: false,
        zodiac: null,
        abCoin: 0,
        dailyCoin: 0,
        profileCompleted: false,
      });
    }

    const user = snap.data() || {};

    return res.json({
      isPremium: user.isPremium === true,
      zodiac: user.zodiac || null,
      abCoin: typeof user.abCoin === "number" ? user.abCoin : 0,
      dailyCoin: typeof user.dailyCoin === "number" ? user.dailyCoin : 0,
      profileCompleted: user.profileCompleted === true,
    });
  } catch (err) {
    console.error("REFRESH ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;