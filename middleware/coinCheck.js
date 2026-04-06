import { PRICING } from "../utils/pricing.js";
import { db } from "../config/firebase.js";

export default function coinCheck(type) {
  return async (req, res, next) => {
    try {
      const uid = req.user?.uid;

      if (!uid) {
        return res.status(401).json({ error: "Token gerekli" });
      }

      let price = null;

      if (["FAL", "RUYA", "EL_FALI"].includes(type)) {
        price = PRICING[type];
      }

      else if (type === "TAROT") {
        const config = PRICING.TAROT;
        const mode = String(req.body?.mode || "").toLowerCase();

        if (!["one", "two", "three", "five", "celtic"].includes(mode)) {
          return res.status(400).json({ error: "Geçersiz tarot mode" });
        }

        if (mode === "one") price = config.ONE_CARD;
        if (mode === "two") price = config.TWO_CARD;
        if (mode === "three") price = config.THREE_CARD;
        if (mode === "five") price = config.FIVE_CARD;
        if (mode === "celtic") price = config.CELTIC_CROSS;
      }

      else if (type === "MELEK") {
        const mode = String(req.body?.mode || "").toLowerCase();

        if (!["standard", "deep", "zaman"].includes(mode)) {
          return res.status(400).json({ error: "Melek modu belirlenemedi" });
        }

        if (mode === "standard") price = PRICING.MELEK.ONE_CARD;
        if (mode === "deep") price = PRICING.MELEK.TWO_CARD;
        if (mode === "zaman") price = PRICING.MELEK.THREE_CARD;
      }

      else if (type === "UYUM") {
        const option = Number.parseInt(req.body?.option, 10);

        if (!Number.isFinite(option) || ![1, 2, 3].includes(option)) {
          return res.status(400).json({ error: "Uyum türü belirlenemedi" });
        }

        if (option === 1) price = PRICING.UYUM.NAME_BIRTH;
        if (option === 2) price = PRICING.UYUM.HAND_PHOTO;
        if (option === 3) price = PRICING.UYUM.BOTH;
      }

      else {
        return res.status(400).json({ error: "Geçersiz işlem tipi" });
      }

      if (!Number.isFinite(price) || price <= 0) {
        return res.status(500).json({ error: "Fiyat hesaplanamadı" });
      }

      const userRef = db.collection("users").doc(uid);
      const snap = await userRef.get();

      if (!snap.exists) {
        return res.status(404).json({ error: "Kullanıcı bulunamadı" });
      }

      const user = snap.data() || {};

      const dailyCoin = typeof user.dailyCoin === "number" ? user.dailyCoin : 0;
      const abCoin = typeof user.abCoin === "number" ? user.abCoin : 0;

      if (dailyCoin + abCoin < price) {
        return res.status(400).json({ error: "Yetersiz coin" });
      }

      req.coinPrice = price;

      return next();
    } catch (err) {
      console.error("COIN CHECK ERROR:", err);
      return res.status(500).json({ error: "Coin kontrol hatası" });
    }
  };
}