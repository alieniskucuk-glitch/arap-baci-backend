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
   DAY DIFFERENCE (TIMEZONE SAFE)
========================= */

function dayDiff(oldKey, newKey) {
  if (!oldKey) return 1;

  const [y1, m1, d1] = oldKey.split("-").map(Number);
  const [y2, m2, d2] = newKey.split("-").map(Number);

  const date1 = Date.UTC(y1, m1 - 1, d1);
  const date2 = Date.UTC(y2, m2 - 1, d2);

  return Math.floor((date2 - date1) / 86400000);
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

      const user = snap.data() || {};

      // Premium değilse çık
      if (!user.isPremium) return;

      // Subscription yoksa çık
      if (!user.subscription?.expiresAt) return;

      // Subscription aktif değilse çık
      if (user.subscription?.status !== "active") return;

      const now = admin.firestore.Timestamp.now();

      // Süresi bitmişse çık
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
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return next();
  } catch (err) {
    console.error("DAILY RESET ERROR:", err);
    return next();
  }
}