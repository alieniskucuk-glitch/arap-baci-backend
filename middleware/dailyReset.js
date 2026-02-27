import admin from "firebase-admin";
import { db } from "../config/firebase.js";

const TZ = "Europe/Istanbul";
const DAILY_PREMIUM_COIN = 8;
const MONTHLY_MAX = 240;

/* =========================
   ISTANBUL DATE KEY
========================= */

function getTodayKey(timeZone) {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y = parts.find(p => p.type === "year")?.value;
  const m = parts.find(p => p.type === "month")?.value;
  const d = parts.find(p => p.type === "day")?.value;

  return `${y}-${m}-${d}`;
}

/* =========================
   DAY DIFFERENCE
========================= */

function dayDiff(oldKey, newKey) {
  if (!oldKey) return 0;

  const oldDate = new Date(oldKey + "T00:00:00");
  const newDate = new Date(newKey + "T00:00:00");

  const diffMs = newDate - oldDate;

  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/* =========================
   DAILY RESET MIDDLEWARE
========================= */

export default async function dailyReset(req, res, next) {
  try {
    const uid = req.user?.uid;
    if (!uid) return next();

    const userRef = db.collection("users").doc(uid);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) return;

      const user = snap.data();

      // Premium değilse çık
      if (!user?.isPremium) return;

      // Subscription yoksa çık
      if (!user.subscription?.expiresAt) return;

      // Süre dolmuşsa çık
      const now = admin.firestore.Timestamp.now();
      if (user.subscription.expiresAt.toMillis() < now.toMillis()) {
        return;
      }

      const todayKey = getTodayKey(TZ);
      const lastKey = user.lastDailyResetKey || todayKey;

      const daysPassed = dayDiff(lastKey, todayKey);

      if (daysPassed <= 0) return;

      const currentDaily = user.dailyCoin || 0;
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