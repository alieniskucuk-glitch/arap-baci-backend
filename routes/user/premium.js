import express from "express";
import auth from "../../middleware/auth.js";
import { db } from "../../config/firebase.js";
import admin from "firebase-admin";

const router = express.Router();

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

    const nowMs = Date.now();
    const ONE_MONTH = 1000 * 60 * 60 * 24 * 30;

    let currentPremiumMs = 0;

    if (user.premiumUntil?.toMillis) {
      currentPremiumMs = user.premiumUntil.toMillis();
    } else if (typeof user.premiumUntil === "number") {
      currentPremiumMs = user.premiumUntil;
    }

    let newPremiumUntilMs = nowMs + ONE_MONTH;

    if (currentPremiumMs > nowMs) {
      newPremiumUntilMs = currentPremiumMs + ONE_MONTH;
    }

    await userRef.set(
      {
        isPremium: true,
        premiumStartedAt: admin.firestore.Timestamp.fromMillis(nowMs),
        premiumUntil: admin.firestore.Timestamp.fromMillis(newPremiumUntilMs),
        premiumStatus: "active",
        premiumAutoRenew: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.json({
      success: true,
      isPremium: true,
      premiumUntil: newPremiumUntilMs,
    });
  } catch (err) {
    console.error("PREMIUM ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;