import admin from "firebase-admin";
import { db } from "../config/firebase.js";

const TZ = "Europe/Istanbul";
const DAILY_PREMIUM_COIN = 8;
const MONTHLY_MAX = 240;

/* =========================
   ISTANBUL DATE KEY
========================= */

function getTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/* =========================
   DAY DIFFERENCE (SAFE)
========================= */

function dayDiff(oldKey, newKey) {
  if (!oldKey) return 1; // 🔥 ilk girişte 1 gün say

  const oldDate = new Date(oldKey + "T00:00:00Z");
  const newDate = new Date(newKey + "T00:00:00Z");

  const diffMs = newDate.getTime() - oldDate.getTime();
  return Math.floor(diffMs / 86400000);
}

/* =========================
   DAILY RESET
========================= */

export default async function dailyReset(req, res, next) {
  try {
    const uid = req.user?.uid;
    if (!uid) return next();

    const userRef = db.collection("users").doc(uid);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) return;

      const user = snap.data() || {};

      if (!user.isPremium) return;
      if (!user.subscription?.expiresAt) return;

      const now = admin.firestore.Timestamp.now();
      if (user.subscription.expiresAt.toMillis() <= now.toMillis()) {
        return;
      }

      const todayKey = getTodayKey();
      const lastKey = user.lastDailyResetKey || null;

      const daysPassed = dayDiff(lastKey, todayKey);

      if (daysPassed <= 0) return;

      const currentDaily = Number(user.dailyCoin ?? 0);
      const earned = daysPassed * DAILY_PREMIUM_COIN;

      const newDailyCoin = Math.min(
        currentDaily + earned,
        MONTHLY_MAX
      );

      tx.update(userRef, {
        dailyCoin: newDailyCoin,
        lastDailyResetKey: todayKey,
        lastDailyResetAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return next();
  } catch (err) {
    console.error("DAILY RESET ERROR:", err);
    return next();
  }
}