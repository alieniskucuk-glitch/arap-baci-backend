import { db } from "../config/firebase.js";

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

    const today = startOfToday();

    let lastReset = null;

    // 🔥 Güvenli tarih parse
    if (user.lastDailyReset && typeof user.lastDailyReset.toDate === "function") {
      lastReset = user.lastDailyReset.toDate();
    }

    // İlk reset
    if (!lastReset) {
      await userRef.update({
        dailyCoin: 8,
        lastDailyReset: today,
      });
      return next();
    }

    const lastResetDay = new Date(
      lastReset.getFullYear(),
      lastReset.getMonth(),
      lastReset.getDate()
    );

    if (today.getTime() > lastResetDay.getTime()) {
      await userRef.update({
        dailyCoin: 8,
        lastDailyReset: today,
      });
    }

    next();

  } catch (err) {
    console.error("DAILY RESET ERROR:", err);
    next(); // zinciri kırma
  }
}
