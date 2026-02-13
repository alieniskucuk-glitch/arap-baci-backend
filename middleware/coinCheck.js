import { PRICING } from "../utils/pricing.js";
import { db } from "../config/firebase.js";

export default function coinCheck(type) {
  return async (req, res, next) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        return res.status(401).json({ error: "Token gerekli" });
      }

      let price;

      /* =========================
         SABİT FİYATLAR
      ========================= */
      if (["FAL", "RUYA", "EL_FALI"].includes(type)) {
        price = PRICING?.[type];
      }

      /* =========================
         TAROT / MELEK
      ========================= */
      if (type === "TAROT" || type === "MELEK") {
        const config = PRICING?.[type];
        const cardCount = Number(req.body.cardCount);

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

      /* =========================
         UYUM
      ========================= */
      if (type === "UYUM") {
        const { nameBirth, handPhoto } = req.body;

        if (nameBirth && handPhoto) {
          price = PRICING.UYUM.BOTH;
        } else if (nameBirth) {
          price = PRICING.UYUM.NAME_BIRTH;
        } else if (handPhoto) {
          price = PRICING.UYUM.HAND_PHOTO;
        } else {
          return res.status(400).json({ error: "Uyum türü belirtilmedi" });
        }
      }

      if (!price || typeof price !== "number") {
        console.error("PRICE ERROR:", type, PRICING);
        return res.status(500).json({ error: "Fiyat hesaplanamadı" });
      }

      /* =========================
         COIN KONTROL
      ========================= */

      const userSnap = await db.collection("users").doc(uid).get();

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
        abCoin
      };

      next();

    } catch (err) {
      console.error("COIN CHECK ERROR:", err);
      return res.status(500).json({ error: "Coin kontrol hatası" });
    }
  };
}
