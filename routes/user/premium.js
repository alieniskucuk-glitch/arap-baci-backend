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
    const snap = await userRef.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    }

    const user = snap.data() || {};

    const nowMs = Date.now();
    const ONE_MONTH = 1000 * 60 * 60 * 24 * 30;

    /* =========================
       SAFE premiumUntil PARSE
    ========================= */

    let currentPremiumMs = 0;

    if (user.premiumUntil?.toMillis) {
      currentPremiumMs = user.premiumUntil.toMillis();
    } else if (typeof user.premiumUntil === "number") {
      currentPremiumMs = user.premiumUntil;
    }

    /* =========================
       PREMIUM EXTEND LOGIC
    ========================= */

    let newPremiumUntilMs = nowMs + ONE_MONTH;

    if (currentPremiumMs > nowMs) {
      newPremiumUntilMs = currentPremiumMs + ONE_MONTH;
    }

    /* =========================
       🔥 GÜNLÜK 8 COIN EKLE (EKLENDİ)
    ========================= */

    const todayKey = getTodayKey();
    const currentDaily = Number(user.dailyCoin) || 0;

    const alreadyGivenToday = user.lastDailyResetKey === todayKey;

    const newDailyCoin = alreadyGivenToday
      ? currentDaily
      : currentDaily + DAILY_PREMIUM_COIN;

    /* =========================
       UPDATE
    ========================= */

    await userRef.set(
      {
        isPremium: true,
        premiumStartedAt: admin.firestore.Timestamp.fromMillis(nowMs),
        premiumUntil: admin.firestore.Timestamp.fromMillis(newPremiumUntilMs),
        premiumStatus: "active",
        premiumAutoRenew: true,

        // 🔥 EKLENEN KISIM
        dailyCoin: newDailyCoin,
        lastDailyResetKey: todayKey,
        lastDailyResetAt: admin.firestore.FieldValue.serverTimestamp(),

        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.json({
      success: true,
      isPremium: true,
      premiumUntil: newPremiumUntilMs,
      dailyAdded: alreadyGivenToday ? 0 : 8,
    });
  } catch (err) {
    console.error("PREMIUM ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;