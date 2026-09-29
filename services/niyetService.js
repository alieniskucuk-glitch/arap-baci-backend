import crypto from "crypto";
import { readFile } from "node:fs/promises";

import { admin, db } from "../config/firebase.js";
import {
  niyetResponseFromDocument,
  operationDocumentId,
} from "../utils/fortuneState.js";
import { PRICING } from "../utils/pricing.js";

const NIYET_FILE = new URL("../utils/niyetler.json", import.meta.url);

const ALLOWED_ANIMALS = new Set([
  "baykus",
  "fennek_tilkisi",
  "geko",
  "guvercin",
  "kaplumbaga",
  "kirpi",
  "kizil_panda",
  "koala",
  "kuzgun",
  "parmak_maymunu",
  "sincap",
  "tavsan",
]);

let cachedPools = null;

function serviceError(message, status = 400, code = "NIYET_ERROR") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function validateRequestId(value) {
  const requestId = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(requestId)) {
    throw serviceError("Geçersiz işlem kimliği", 400, "INVALID_REQUEST_ID");
  }
  return requestId;
}

function validatePool(value, name) {
  if (!Array.isArray(value) || value.length === 0) {
    throw serviceError(
      `niyetler.json içindeki ${name} havuzu geçersiz`,
      500,
      "NIYET_DATA_INVALID",
    );
  }

  return value.map((item) => {
    const id = String(item?.id || "").trim();
    const theme = String(item?.theme || "").trim();
    const text = String(item?.text || "").trim();

    if (!id || !theme || !text) {
      throw serviceError(
        `niyetler.json içindeki ${name} havuzunda eksik alan var`,
        500,
        "NIYET_DATA_INVALID",
      );
    }

    return { id, theme, text };
  });
}

async function loadPools() {
  if (cachedPools) return cachedPools;

  let raw;
  try {
    raw = await readFile(NIYET_FILE, "utf8");
  } catch (error) {
    console.error("NİYET JSON READ ERROR:", error);
    throw serviceError(
      "Niyet sonuçları okunamadı",
      500,
      "NIYET_DATA_UNAVAILABLE",
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error("NİYET JSON PARSE ERROR:", error);
    throw serviceError(
      "Niyet sonuçları çözümlenemedi",
      500,
      "NIYET_DATA_INVALID",
    );
  }

  cachedPools = {
    ortak: validatePool(parsed?.ortak, "ortak"),
    kadin: validatePool(parsed?.kadin, "kadin"),
    erkek: validatePool(parsed?.erkek, "erkek"),
  };

  return cachedPools;
}

function poolForGender(pools, gender) {
  const normalized = String(gender || "").trim().toLocaleLowerCase("tr-TR");

  if (normalized === "kadın" || normalized === "kadin") {
    return [...pools.ortak, ...pools.kadin];
  }

  if (normalized === "erkek") {
    return [...pools.ortak, ...pools.erkek];
  }

  return pools.ortak;
}

function deductBalances(user, price) {
  let dailyCoin = Math.max(0, Number(user?.dailyCoin) || 0);
  let abCoin = Math.max(0, Number(user?.abCoin) || 0);
  const before = { dailyCoin, abCoin };

  let remaining = price;
  const dailyUsed = Math.min(dailyCoin, remaining);
  dailyCoin -= dailyUsed;
  remaining -= dailyUsed;

  if (remaining > abCoin) {
    throw serviceError("Yetersiz coin", 400, "INSUFFICIENT_COIN");
  }

  abCoin -= remaining;
  return {
    before,
    after: { dailyCoin, abCoin },
    remainingTotalCoin: dailyCoin + abCoin,
  };
}

export async function revealNiyet(uid, { requestId: rawRequestId, animal, gender }) {
  const requestId = validateRequestId(rawRequestId);
  const normalizedAnimal = String(animal || "").trim();

  if (!ALLOWED_ANIMALS.has(normalizedAnimal)) {
    throw serviceError("Geçersiz hayvan seçimi", 400, "INVALID_ANIMAL");
  }

  const pools = await loadPools();
  const pool = poolForGender(pools, gender);
  if (pool.length === 0) {
    throw serviceError(
      "Uygun niyet sonucu bulunamadı",
      500,
      "NIYET_RESULT_UNAVAILABLE",
    );
  }

  const price = PRICING.NIYET;
  const userRef = db.collection("users").doc(uid);
  const operationId = operationDocumentId("niyet", requestId);
  const resultRef = userRef.collection("history").doc(operationId);
  const transactionRef = userRef
    .collection("transactions")
    .doc(operationId);

  let response;

  await db.runTransaction(async (tx) => {
    const [userSnap, resultSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(resultRef),
    ]);

    if (resultSnap.exists) {
      response = niyetResponseFromDocument(resultSnap.data() || {}, {
        charged: false,
      });
      return;
    }

    if (!userSnap.exists) {
      throw serviceError("Kullanıcı bulunamadı", 404, "USER_NOT_FOUND");
    }

    const selected = pool[crypto.randomInt(pool.length)];
    const balances = deductBalances(userSnap.data() || {}, price);
    const historyData = {
      type: "niyet",
      requestId,
      animal: normalizedAnimal,
      resultId: selected.id,
      resultTheme: selected.theme,
      interpretation: selected.text,
      charged: true,
      cost: price,
      remainingCoin: balances.remainingTotalCoin,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    tx.update(userRef, {
      ...balances.after,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.set(transactionRef, {
      type: "niyet",
      amount: -price,
      before: balances.before,
      after: balances.after,
      meta: { animal: normalizedAnimal, requestId },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.set(resultRef, historyData);
    response = niyetResponseFromDocument(historyData);
  });

  return response;
}
