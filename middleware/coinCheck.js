import { PRICING } from "../utils/pricing.js";
import { db } from "../config/firebase.js";

export default function coinCheck(type) {
  return async (req, res, next) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        return res.status(401).json({ error: "Token gerekli" });
      }

      const userRef = db.collection("users").doc(uid);

      /* =========================
         FİYAT HESAPLAMA
      ========================= */

      let price;

      if (["FAL", "RUYA", "EL_FALI"].includes(type)) {
        price = PRICING[type];
      }

      if (type === "TAROT") {
        const config = PRICING[type];
        const mode = req.body.mode;

        if (!["one", "two", "three", "five", "celtic"].includes(mode)) {
          return res.status(400).json({ error: "Geçersiz tarot mode" });
        }

        if (mode === "one") price = config.ONE_CARD;
        if (mode === "two") price = config.TWO_CARD;
        if (mode === "three") price = config.THREE_CARD;
        if (mode === "five") price = config.FIVE_CARD;
        if (mode === "celtic") price = config.CELTIC_CROSS;
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