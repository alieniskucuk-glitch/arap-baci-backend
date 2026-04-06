import admin from "firebase-admin";
import { db } from "../config/firebase.js";

const TZ = "Europe/Istanbul";
const DAILY_PREMIUM_COIN = 8;
const MONTHLY_MAX = 240;

function getTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dayDiff(oldKey, newKey) {
  if (!oldKey) return 1; // 🔥 ilk girişte 8 coin

  const [y1, m1, d1] = oldKey.split("-").map(Number);
  const [y2, m2, d2] = newKey.split("-").map(Number);

  const date1 = Date.UTC(y1, m1 - 1, d1);
  const date2 = Date.UTC(y2, m2 - 1, d2);

  return Math.floor((date2 - date1) / 86400000);
}

export default async function dailyReset(req, res, next) {
  try {
    const uid = req.user?.uid;
    if (!uid) return next();

    const userRef = db.collection("users").doc(uid);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) return;

      const user = snap.data() || {};

      /* =========================
         PREMIUM CHECK
      ========================= */

      let premiumUntilMs = 0;

      if (user.premiumUntil?.toMillis) {
        premiumUntilMs = user.premiumUntil.toMillis();
      } else if (typeof user.premiumUntil === "number") {
        premiumUntilMs = user.premiumUntil;
      }

      const nowMs = Date.now();

      // 🔥 premium bitmişse kapat
      if (!premiumUntilMs || premiumUntilMs <= nowMs) {
        tx.update(userRef, {
          isPremium: false,
          premiumStatus: "expired",
          premiumAutoRenew: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }

      /* =========================
         DAILY RESET
      ========================= */

      const todayKey = getTodayKey();
      const lastKey = user.lastDailyResetKey || null;

      const daysPassed = dayDiff(lastKey, todayKey);

      if (daysPassed <= 0) return;

      const safeDays = Math.min(daysPassed, 30);
      const earned = safeDays * DAILY_PREMIUM_COIN;

      const currentDaily = Number(user.dailyCoin) || 0;

      // 🔥 MAX LIMIT KORUMA
      const finalEarn = Math.min(
        earned,
        MONTHLY_MAX - currentDaily
      );

      if (finalEarn <= 0) return;

      /* =========================
         UPDATE (ATOMIC)
      ========================= */

      tx.update(userRef, {
        dailyCoin: admin.firestore.FieldValue.increment(finalEarn),
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