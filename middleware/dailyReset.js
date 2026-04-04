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
   DAY DIFFERENCE
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
      const now = admin.firestore.Timestamp.now();

      // Premium değilse çık
      if (user.isPremium !== true) return;

      // Status kontrol
      if (user.premiumStatus !== "active") {
        tx.update(userRef, {
          isPremium: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }

      // 🔥 premiumUntil (timestamp uyumlu)
      let premiumUntilMs = 0;

      if (user.premiumUntil?.toMillis) {
        premiumUntilMs = user.premiumUntil.toMillis();
      } else if (typeof user.premiumUntil === "number") {
        premiumUntilMs = user.premiumUntil;
      }

      // Premium yoksa kapat
      if (!premiumUntilMs) {
        tx.update(userRef, {
          isPremium: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }

      // Süre bittiyse kapat
      if (premiumUntilMs <= now.toMillis()) {
        tx.update(userRef, {
          isPremium: false,
          premiumStatus: "expired",
          premiumAutoRenew: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }

      const todayKey = getTodayKey();
      const lastKey = user.lastDailyResetKey || null;

      const daysPassed = dayDiff(lastKey, todayKey);

      // Aynı gün tekrar verme
      if (daysPassed <= 0) return;

      const currentDaily =
        typeof user.dailyCoin === "number" && Number.isFinite(user.dailyCoin)
          ? user.dailyCoin
          : 0;

      // max 30 gün birikim
      const safeDays = Math.min(daysPassed, 30);

      const earned = safeDays * DAILY_PREMIUM_COIN;

      const newDailyCoin = Math.min(currentDaily + earned, MONTHLY_MAX);

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