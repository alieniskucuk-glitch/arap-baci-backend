import express from "express";
import admin from "firebase-admin";

import auth from "../middleware/auth.js";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ================= DATE ================= */

function getTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/* ================= REWARD ================= */

router.post("/", auth, async (req, res) => {
  try {
    const uid = req.user.uid;

    const userRef = db.collection("users").doc(uid);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);

      if (!snap.exists) {
        throw new Error("USER_NOT_FOUND");
      }

      const data = snap.data();

      const today = getTodayKey();

      let rewardDate = data.rewardDate || "";
      let rewardCount = data.rewardCount || 0;

      // GÜN DEĞİŞTİYSE RESET
      if (rewardDate !== today) {
        rewardDate = today;
        rewardCount = 0;
      }

      // LIMIT
      if (rewardCount >= 5) {
        throw new Error("DAILY_LIMIT");
      }

      tx.update(userRef, {
        abCoin: admin.firestore.FieldValue.increment(1),
        rewardDate: today,
        rewardCount: rewardCount + 1,
      });
    });

    return res.json({
      success: true,
      reward: 1,
    });
  } catch (e) {
    console.error(e);

    if (e.message === "DAILY_LIMIT") {
      return res.status(403).json({
        error: "DAILY_LIMIT",
      });
    }

    return res.status(500).json({
      error: "REWARD_FAILED",
    });
  }
});

export default router;