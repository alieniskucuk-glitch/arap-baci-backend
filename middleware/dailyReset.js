import { admin, db } from "../config/firebase.js";

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
    const user = snap.data();

    if (!user) return next();

    // Premium değilse geç
    if (!user.isPremium) return next();

    const today = startOfToday();
    const lastReset = user.lastDailyReset?.toDate?.();

    // Eğer hiç reset yapılmamışsa
    if (!lastReset) {
      await userRef.update({
        dailyCoin: 8,
        lastDailyReset: today,
      });
      return next();
    }

    // Gün değişmiş mi kontrol
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
    next();
  }
}
