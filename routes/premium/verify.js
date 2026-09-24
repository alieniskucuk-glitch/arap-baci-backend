import crypto from "crypto";
import express from "express";
import { google } from "googleapis";

import auth from "../../middleware/auth.js";
import { admin, db } from "../../config/firebase.js";

const router = express.Router();

const PACKAGE_NAME =
  process.env.GOOGLE_PLAY_PACKAGE_NAME || "com.arapbaci.app";
const APPLE_BUNDLE_ID =
  process.env.APPLE_BUNDLE_ID || "com.arapbaci.app";
const PREMIUM_PRODUCT_ID = "premium_monthly";
const COIN_PRODUCTS = new Map([
  ["coin_25", 25],
  ["coin_50", 50],
  ["coin_100", 100],
]);

const googleCredentials = (() => {
  const clientEmail =
    process.env.GOOGLE_PLAY_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (
    process.env.GOOGLE_PLAY_PRIVATE_KEY ||
    process.env.FIREBASE_PRIVATE_KEY ||
    ""
  ).replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) return undefined;

  return {
    client_email: clientEmail,
    private_key: privateKey,
  };
})();

const googleAuth = new google.auth.GoogleAuth({
  ...(googleCredentials ? { credentials: googleCredentials } : {}),
  scopes: ["https://www.googleapis.com/auth/androidpublisher"],
});

function serviceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function purchaseRef(platform, transactionId) {
  const id = crypto
    .createHash("sha256")
    .update(`${platform}:${transactionId}`)
    .digest("hex");

  return db.collection("iapPurchases").doc(id);
}

async function verifyGooglePurchase({ productId, purchaseToken }) {
  const androidPublisher = google.androidpublisher({
    version: "v3",
    auth: googleAuth,
  });

  if (COIN_PRODUCTS.has(productId)) {
    const response = await androidPublisher.purchases.products.get({
      packageName: PACKAGE_NAME,
      productId,
      token: purchaseToken,
    });
    const purchase = response.data || {};

    if (Number(purchase.purchaseState) !== 0) {
      throw serviceError("Satın alma aktif değil");
    }

    return {
      transactionId:
        purchase.orderId ||
        crypto.createHash("sha256").update(purchaseToken).digest("hex"),
      expiresAtMs: null,
    };
  }

  const response = await androidPublisher.purchases.subscriptionsv2.get({
    packageName: PACKAGE_NAME,
    token: purchaseToken,
  });
  const subscription = response.data || {};

  if (subscription.subscriptionState !== "SUBSCRIPTION_STATE_ACTIVE") {
    throw serviceError("Abonelik aktif değil");
  }

  const matchingLine = (subscription.lineItems || []).find(
    (item) => item?.productId === productId,
  );
  const expiresAtMs = Date.parse(matchingLine?.expiryTime || "");

  if (!matchingLine || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    throw serviceError("Abonelik süresi geçersiz");
  }

  return {
    transactionId:
      subscription.latestOrderId ||
      crypto.createHash("sha256").update(purchaseToken).digest("hex"),
    expiresAtMs,
  };
}

async function postAppleReceipt(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw serviceError("Apple doğrulama servisine ulaşılamadı", 502);
  }

  return response.json();
}

async function verifyApplePurchase({ productId, purchaseToken }) {
  const sharedSecret = process.env.APPLE_SHARED_SECRET;

  if (productId === PREMIUM_PRODUCT_ID && !sharedSecret) {
    throw serviceError("Apple abonelik doğrulaması yapılandırılmamış", 503);
  }

  const requestBody = {
    "receipt-data": purchaseToken,
    "exclude-old-transactions": false,
    ...(sharedSecret ? { password: sharedSecret } : {}),
  };

  let receipt = await postAppleReceipt(
    "https://buy.itunes.apple.com/verifyReceipt",
    requestBody,
  );

  if (Number(receipt.status) === 21007) {
    receipt = await postAppleReceipt(
      "https://sandbox.itunes.apple.com/verifyReceipt",
      requestBody,
    );
  }

  if (
    Number(receipt.status) !== 0 ||
    receipt.receipt?.bundle_id !== APPLE_BUNDLE_ID
  ) {
    throw serviceError("Apple satın alma doğrulanamadı");
  }

  const candidates = [
    ...(receipt.latest_receipt_info || []),
    ...(receipt.receipt?.in_app || []),
  ]
    .filter(
      (item) =>
        item?.product_id === productId && !item?.cancellation_date,
    )
    .sort(
      (left, right) =>
        Number(right.expires_date_ms || right.purchase_date_ms || 0) -
        Number(left.expires_date_ms || left.purchase_date_ms || 0),
    );

  const purchase = candidates[0];
  if (!purchase?.transaction_id) {
    throw serviceError("Apple ürünü makbuzda bulunamadı");
  }

  if (productId === PREMIUM_PRODUCT_ID) {
    const expiresAtMs = Number(purchase.expires_date_ms);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      throw serviceError("Apple aboneliği aktif değil");
    }

    return {
      transactionId: purchase.transaction_id,
      expiresAtMs,
    };
  }

  return {
    transactionId: purchase.transaction_id,
    expiresAtMs: null,
  };
}

async function applyVerifiedPurchase({
  uid,
  platform,
  productId,
  transactionId,
  expiresAtMs,
}) {
  const userRef = db.collection("users").doc(uid);
  const verifiedRef = purchaseRef(platform, transactionId);
  let duplicate = false;

  await db.runTransaction(async (transaction) => {
    const [userSnapshot, purchaseSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(verifiedRef),
    ]);

    if (!userSnapshot.exists) {
      throw serviceError("Kullanıcı bulunamadı", 404);
    }

    if (purchaseSnapshot.exists) {
      const existing = purchaseSnapshot.data() || {};
      if (existing.uid !== uid || existing.productId !== productId) {
        throw serviceError("Satın alma başka bir hesaba ait", 409);
      }

      duplicate = true;
      return;
    }

    const user = userSnapshot.data() || {};

    if (COIN_PRODUCTS.has(productId)) {
      const amount = COIN_PRODUCTS.get(productId);
      transaction.update(userRef, {
        abCoin: Math.max(0, Number(user.abCoin) || 0) + amount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      const key = todayKey();
      const alreadyGranted = user.lastDailyResetKey === key;
      const currentDaily = Math.max(0, Number(user.dailyCoin) || 0);

      transaction.update(userRef, {
        isPremium: true,
        premiumStatus: "active",
        premiumAutoRenew: true,
        premiumType: "monthly",
        premiumSubscriptionId: PREMIUM_PRODUCT_ID,
        premiumUntil: admin.firestore.Timestamp.fromMillis(expiresAtMs),
        premiumUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(!alreadyGranted
          ? {
              dailyCoin: Math.min(240, currentDaily + 8),
              lastDailyResetKey: key,
              lastDailyResetAt: admin.firestore.FieldValue.serverTimestamp(),
            }
          : {}),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    transaction.set(verifiedRef, {
      uid,
      platform,
      productId,
      transactionId,
      expiresAtMs: expiresAtMs || null,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return duplicate;
}

router.post("/verify", auth, async (req, res) => {
  try {
    const uid = req.user?.uid;
    const platform = String(req.body?.platform || "").toLowerCase();
    const productId = String(req.body?.productId || "").trim();
    const purchaseToken = String(req.body?.purchaseToken || "").trim();

    if (
      !uid ||
      !["android", "ios"].includes(platform) ||
      !purchaseToken ||
      !(productId === PREMIUM_PRODUCT_ID || COIN_PRODUCTS.has(productId))
    ) {
      throw serviceError("Geçersiz satın alma isteği");
    }

    const verified =
      platform === "ios"
        ? await verifyApplePurchase({ productId, purchaseToken })
        : await verifyGooglePurchase({ productId, purchaseToken });

    const duplicate = await applyVerifiedPurchase({
      uid,
      platform,
      productId,
      transactionId: verified.transactionId,
      expiresAtMs: verified.expiresAtMs,
    });

    return res.json({
      success: true,
      type: productId === PREMIUM_PRODUCT_ID ? "premium" : "coin",
      duplicate,
    });
  } catch (error) {
    console.error("IAP VERIFY ERROR:", error);

    const statusCode = Number.isInteger(error?.statusCode)
      ? error.statusCode
      : 502;

    return res.status(statusCode).json({
      success: false,
      error:
        statusCode >= 500 ? "Satın alma doğrulanamadı" : error.message,
    });
  }
});

export default router;
