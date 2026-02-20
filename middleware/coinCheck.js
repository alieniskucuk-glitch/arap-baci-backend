import admin from "firebase-admin";
import { PRICING } from "../utils/pricing.js";
import { db } from "../config/firebase.js";

const TZ = "Europe/Istanbul";
const DAILY_PREMIUM_COIN = 8;

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

export default function coinCheck(type) {
  return async (req, res, next) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        return res.status(401).json({ error: "Token gerekli" });
      }

      const userRef = db.collection("users").doc(uid);

      /* =========================
         🔥 DAILY RESET (PRO)
      ========================= */
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists) return;

        const user = snap.data();
        if (!user?.isPremium) return;

        const todayKey = getTodayKey(TZ);
        const lastKey = user.lastDailyResetKey || null;

        if (lastKey === todayKey) return;

        tx.update(userRef, {
          dailyCoin: DAILY_PREMIUM_COIN,
          lastDailyResetKey: todayKey,
          lastDailyResetAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      /* =========================
         FİYAT HESAPLAMA
      ========================= */

      let price;

      if (["FAL", "RUYA", "EL_FALI"].includes(type)) {
        price = PRICING[type];
      }

      if (type === "TAROT") {
        const config = PRICING[type];
        const cardCount = parseInt(req.body.cardCount, 10);

        if (!cardCount || cardCount < 1) {
          return res.status(400).json({ error: "Geçersiz kart sayısı" });
        }

        if (cardCount > config.MAX_CARD) {
          return res.status(400).json({ error: "Kart limiti aşıldı" });
        }

        if (cardCount === 1) price = config.ONE_CARD;
        if (cardCount === 2) price = config.TWO_CARD;
        if (cardCount === 3) price = config.THREE_CARD;
      }

      if (type === "MELEK") {
        const mode = req.body.mode;

        if (!["standard", "deep", "zaman"].includes(mode)) {
          return res.status(400).json({ error: "Melek modu belirlenemedi" });
        }

        if (mode === "standard") price = PRICING.MELEK.ONE_CARD;
        if (mode === "deep") price = PRICING.MELEK.TWO_CARD;
        if (mode === "zaman") price = PRICING.MELEK.THREE_CARD;
      }

      if (type === "UYUM") {
        const option = parseInt(req.body.option, 10);

        if (![1, 2, 3].includes(option)) {
          return res.status(400).json({ error: "Uyum türü belirlenemedi" });
        }

        if (option === 1) price = PRICING.UYUM.NAME_BIRTH;
        if (option === 2) price = PRICING.UYUM.HAND_PHOTO;
        if (option === 3) price = PRICING.UYUM.BOTH;
      }

      if (!price || typeof price !== "number") {
        return res.status(500).json({ error: "Fiyat hesaplanamadı" });
      }

      /* =========================
         COIN KONTROL
      ========================= */

      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        return res.status(400).json({ error: "Kullanıcı bulunamadı" });
      }

      const user = userSnap.data();

      const dailyCoin = Number(user.dailyCoin ?? 0) || 0;
      const abCoin = Number(user.abCoin ?? 0) || 0;

      const totalCoin = dailyCoin + abCoin;

      if (totalCoin < price) {
        return res.status(400).json({ error: "Yetersiz coin" });
      }

      req.coinPrice = price;
      req.userCoins = {
        dailyCoin,
        abCoin,
      };

      next();
    } catch (err) {
      console.error("COIN CHECK ERROR:", err);
      return res.status(500).json({ error: "Coin kontrol hatası" });
    }
  };
}
