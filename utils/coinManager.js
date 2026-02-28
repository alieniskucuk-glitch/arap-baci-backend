import { admin, db } from "../config/firebase.js";

function getUserRef(uid) {
  return db.collection("users").doc(uid);
}

function getTransactionRef(uid) {
  return db
    .collection("users")
    .doc(uid)
    .collection("transactions")
    .doc();
}

/**
 * decreaseCoin
 *
 * @param {string} uid
 * @param {number} price
 * @param {string} type
 * @param {object} meta
 *
 * @returns {number} remainingTotalCoin
 */
export async function decreaseCoin(uid, price, type, meta = {}) {
  if (!uid) throw new Error("UID gerekli");

  const parsedPrice = Number(price);
  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    throw new Error("Geçersiz price");
  }

  const userRef = getUserRef(uid);
  const transactionRef = getTransactionRef(uid);

  let remainingTotalCoin = 0;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);

    if (!snap.exists) {
      throw new Error("Kullanıcı bulunamadı");
    }

    const user = snap.data() || {};

    let dailyCoin = Number(user.dailyCoin ?? 0);
    let abCoin = Number(user.abCoin ?? 0);

    const beforeDaily = dailyCoin;
    const beforeAb = abCoin;

    let remaining = parsedPrice;

    /* =========================
       1️⃣ Önce dailyCoin düş
    ========================= */
    if (dailyCoin > 0) {
      const usedFromDaily = Math.min(dailyCoin, remaining);
      dailyCoin -= usedFromDaily;
      remaining -= usedFromDaily;
    }

    /* =========================
       2️⃣ Kalanı abCoin'den düş
    ========================= */
    if (remaining > 0) {
      if (abCoin < remaining) {
        throw new Error("Yetersiz coin");
      }

      abCoin -= remaining;
      remaining = 0;
    }

    if (remaining !== 0) {
      throw new Error("Coin hesaplama hatası");
    }

    const afterDaily = Math.max(0, dailyCoin);
    const afterAb = Math.max(0, abCoin);

    remainingTotalCoin = afterDaily + afterAb;

    /* =========================
       USER UPDATE
    ========================= */
    tx.update(userRef, {
      dailyCoin: afterDaily,
      abCoin: afterAb,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    /* =========================
       TRANSACTION LOG
    ========================= */
    tx.set(transactionRef, {
      type,
      amount: -parsedPrice,
      before: {
        dailyCoin: beforeDaily,
        abCoin: beforeAb,
      },
      after: {
        dailyCoin: afterDaily,
        abCoin: afterAb,
      },
      meta,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return remainingTotalCoin;
}