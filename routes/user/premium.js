import express from "express";
import auth from "../../middleware/auth.js";
import { db } from "../../config/firebase.js";
import admin from "firebase-admin";

const router = express.Router();

const TZ = "Europe/Istanbul";
const DAILY_PREMIUM_COIN = 8;

function getTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

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

    let responseData = null;

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);

      if (!snap.exists) {
        throw new Error("Kullanıcı bulunamadı");
      }

      const user = snap.data() || {};

      const nowMs = Date.now();
      const ONE_MONTH = 1000 * 60 * 60 * 24 * 30;

      /* =========================
         PREMIUM TIME
      ========================= */

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

      /* =========================
         🔥 ANINDA 8 COIN
      ========================= */

      const todayKey = getTodayKey();

      const alreadyGivenToday =
        user.lastPremiumGivenKey === todayKey;

      let dailyAdded = 0;

      const dailyUpdate = !alreadyGivenToday
        ? admin.firestore.FieldValue.increment(DAILY_PREMIUM_COIN)
        : user.dailyCoin || 0;

      if (!alreadyGivenToday) {
        dailyAdded = DAILY_PREMIUM_COIN;
      }

      /* =========================
         UPDATE
      ========================= */

      tx.update(userRef, {
        isPremium: true,
        premiumStartedAt: admin.firestore.Timestamp.fromMillis(nowMs),
        premiumUntil: admin.firestore.Timestamp.fromMillis(newPremiumUntilMs),
        premiumStatus: "active",
        premiumAutoRenew: true,

        dailyCoin: dailyUpdate,

        // 🔥 SADECE PREMIUM İÇİN
        lastPremiumGivenKey: todayKey,

        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      responseData = {
        success: true,
        isPremium: true,
        premiumUntil: newPremiumUntilMs,
        dailyAdded,
      };
    });

    return res.json(responseData);
  } catch (err) {
    console.error("PREMIUM ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;