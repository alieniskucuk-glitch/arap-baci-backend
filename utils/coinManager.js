import { admin, db } from "../config/firebase.js";

function userRef(uid) {
  return db.collection("users").doc(uid);
}

function transactionRef(uid) {
  return db
    .collection("users")
    .doc(uid)
    .collection("transactions")
    .doc();
}

/**
 * price: kaç coin düşecek
 * type: "FAL" | "TAROT" vs
 * meta: { falId, tarotId vs }
 */
export async function decreaseCoin(uid, price, type, meta = {}) {
  const ref = userRef(uid);
  const txRef = transactionRef(uid);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const user = snap.data() || {};

    let dailyCoin = Number(user.dailyCoin || 0);
    let abCoin = Number(user.abCoin || 0);

    const beforeDaily = dailyCoin;
    const beforeAb = abCoin;

    let remaining = price;

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

    const afterDaily = dailyCoin;
    const afterAb = abCoin;

    /* =========================
       Update user coinleri
    ========================= */
    tx.update(ref, {
      dailyCoin: afterDaily,
      abCoin: afterAb,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    /* =========================
       Log yaz
    ========================= */
    tx.set(txRef, {
      type,
      amount: -price,
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
}
