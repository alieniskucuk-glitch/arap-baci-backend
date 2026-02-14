import admin from "firebase-admin";
import { db } from "../config/firebase.js";

const TZ = "Europe/Istanbul";

function startOfTodayInTZ(timeZone) {
  const now = new Date();

  // O timezone’daki Y-M-D’yi al
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y = parts.find(p => p.type === "year")?.value;
  const m = parts.find(p => p.type === "month")?.value;
  const d = parts.find(p => p.type === "day")?.value;

  // Bu tarih stringini Date’e çeviriyoruz (00:00) — karşılaştırma için yeterli
  return new Date(`${y}-${m}-${d}T00:00:00`);
}

function toDateSafe(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate(); // Firestore Timestamp
  if (typeof v === "string") {
    const dt = new Date(v);
    return isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

export default async function dailyReset(req, res, next) {
  try {
    const uid = req.user?.uid;
    if (!uid) return next();

    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) return next();

    const user = snap.data();

    // Premium değilse geç
    if (!user?.isPremium) return next();

    const today = startOfTodayInTZ(TZ);

    const lastReset = toDateSafe(user.lastDailyReset);

    // İlk reset
    if (!lastReset) {
      await userRef.update({
        dailyCoin: 8,
        lastDailyReset: admin.firestore.Timestamp.fromDate(today),
      });
      return next();
    }

    const lastResetDay = startOfTodayInTZ(TZ);
    // lastReset’i de aynı mantığa çekelim:
    const last = new Date(
      new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(lastReset) + "T00:00:00"
    );

    if (today.getTime() > last.getTime()) {
      await userRef.update({
        dailyCoin: 8,
        lastDailyReset: admin.firestore.Timestamp.fromDate(today),
      });
    }

    return next();
  } catch (err) {
    console.error("DAILY RESET ERROR:", err);
    return next();
  }
}
