import openai from "../config/openai.js";
import { admin, db } from "../config/firebase.js";
import { MELEK_DECK } from "../utils/melekDeck.js";
import {
  allDailyInterpretationsComplete,
  claimDailyInterpretation,
  completeDailyInterpretation,
  completeGeneralInterpretation,
  dailyInterpretation,
  isDailyComplete,
  isDailyProcessingFresh,
  nextIncompleteDay,
  operationDocumentId,
  resetDailyInterpretation,
  resetGeneralInterpretation,
} from "../utils/fortuneState.js";
import { PRICING } from "../utils/pricing.js";
import { tarotDeck } from "../utils/tarotDeck.js";

const ACTIVE_FIELD = "activeSevenDayProphecy";
const GENERAL_LOCK_MS = 2 * 60 * 1000;

function serviceError(message, status = 400, code = "SEVEN_DAY_ERROR") {
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

function deckFor(type) {
  if (type === "tarot") return tarotDeck;
  if (type === "melek") return MELEK_DECK;
  throw serviceError("Geçersiz deste türü", 400, "INVALID_DECK");
}

function cardName(card) {
  return String(card?.name || card?.title || "").trim();
}

function cardFor(type, id) {
  const parsedId = Number.parseInt(id, 10);
  if (!Number.isInteger(parsedId)) return null;
  return deckFor(type).find((card) => card.id === parsedId) || null;
}

function turkeyDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateKeyMs(key) {
  const [year, month, day] = String(key).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function addDays(key, days) {
  return new Date(dateKeyMs(key) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}

function unlockedDay(series, now = new Date()) {
  const elapsed = Math.floor(
    (dateKeyMs(turkeyDateKey(now)) - dateKeyMs(series.startDateKey)) / 86400000,
  );
  return Math.max(1, Math.min(7, elapsed + 1));
}

function serializeSeries(series, now = new Date()) {
  if (!series) return null;

  const availableThrough = unlockedDay(series, now);
  const nextDay = nextIncompleteDay(series);
  const nowMs = now.getTime();

  return {
    id: series.id,
    deckType: series.deckType,
    startDate: series.startDateKey,
    status: series.status,
    cost: series.cost,
    generalInterpretation: series.generalInterpretation || null,
    completedAtMs: series.completedAtMs || null,
    days: (series.days || []).map((day) => {
      const dailyComplete = isDailyComplete(day);
      const cardRevealed =
        day.cardRevealed === true || day.opened === true || dailyComplete;
      const dailyProcessing = isDailyProcessingFresh(day, nowMs);
      const retryDaily =
        day.day === nextDay &&
        day.day <= availableThrough &&
        !dailyComplete &&
        !dailyProcessing;
      const retryGeneral =
        day.day === 7 &&
        dailyComplete &&
        allDailyInterpretationsComplete(series) &&
        (series.status === "general_ready" ||
          (!series.generalInterpretation &&
            (series.status === "general_pending" ||
              (series.status === "generating_general" &&
                nowMs -
                    Number(series.generalGenerationStartedAtMs || 0) >=
                  GENERAL_LOCK_MS))));
      const base = {
        day: day.day,
        unlockDate: addDays(series.startDateKey, day.day - 1),
        opened: dailyComplete,
        processing: dailyProcessing,
        canOpen: retryGeneral || retryDaily,
      };

      if (!cardRevealed) return base;

      const card = cardFor(series.deckType, day.cardId);
      return {
        ...base,
        openedAtMs: day.openedAtMs || null,
        card: card
          ? {
              id: card.id,
              name: cardName(card),
              image: card.image,
            }
          : null,
        shortInterpretation: dailyInterpretation(day) || null,
      };
    }),
  };
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

function validateSelectedCards(deckType, values) {
  if (!Array.isArray(values) || values.length !== 7) {
    throw serviceError("Tam olarak 7 kart seçilmelidir", 400, "INVALID_CARDS");
  }

  const ids = values.map((value) => Number.parseInt(value, 10));
  if (ids.some((id) => !Number.isInteger(id)) || new Set(ids).size !== 7) {
    throw serviceError("Kartlar farklı olmalıdır", 400, "INVALID_CARDS");
  }

  if (ids.some((id) => !cardFor(deckType, id))) {
    throw serviceError("Deste içinde bulunmayan kart seçildi", 400, "INVALID_CARDS");
  }

  return ids;
}

export function getSevenDayDeck(deckType) {
  return {
    deckType,
    cardIds: deckFor(deckType).map((card) => card.id),
  };
}

export async function getActiveSevenDay(uid) {
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) {
    throw serviceError("Kullanıcı bulunamadı", 404, "USER_NOT_FOUND");
  }

  return { series: serializeSeries(userSnap.data()?.[ACTIVE_FIELD] || null) };
}

export async function startSevenDay(uid, body) {
  const requestId = validateRequestId(body?.requestId);
  const deckType = String(body?.deckType || "").trim().toLowerCase();
  const selectedCardIds = validateSelectedCards(deckType, body?.selectedCardIds);
  const price = PRICING.YEDI_GUNLUK_KEHANET;
  const userRef = db.collection("users").doc(uid);
  const operationId = operationDocumentId("yedi_gunluk", requestId);
  const transactionRef = userRef
    .collection("transactions")
    .doc(operationId);
  const historyRef = userRef.collection("history").doc(operationId);

  let result;

  await db.runTransaction(async (tx) => {
    const [userSnap, transactionSnap, historySnap] = await Promise.all([
      tx.get(userRef),
      tx.get(transactionRef),
      tx.get(historyRef),
    ]);
    if (!userSnap.exists) {
      throw serviceError("Kullanıcı bulunamadı", 404, "USER_NOT_FOUND");
    }

    const user = userSnap.data() || {};
    const existing = user[ACTIVE_FIELD];

    if (historySnap.exists) {
      result = {
        series: serializeSeries(historySnap.data()?.series || null),
        charged: false,
        remainingCoin:
          Math.max(0, Number(user.dailyCoin) || 0) +
          Math.max(0, Number(user.abCoin) || 0),
      };
      return;
    }

    if (existing) {
      if (existing.id === requestId) {
        result = {
          series: serializeSeries(existing),
          charged: false,
          remainingCoin:
            Math.max(0, Number(user.dailyCoin) || 0) +
            Math.max(0, Number(user.abCoin) || 0),
        };
        return;
      }

      throw serviceError(
        "Devam eden 7 Günlük Kehanet serisi var",
        409,
        "ACTIVE_SERIES_EXISTS",
      );
    }

    if (transactionSnap.exists) {
      throw serviceError(
        "Bu seri işlemi daha önce işlendi",
        409,
        "SERIES_OPERATION_ALREADY_PROCESSED",
      );
    }

    const balances = deductBalances(user, price);
    const nowMs = Date.now();
    const series = {
      id: requestId,
      deckType,
      startDateKey: turkeyDateKey(),
      status: "active",
      cost: price,
      createdAtMs: nowMs,
      generalInterpretation: null,
      days: selectedCardIds.map((cardId, index) => ({
        day: index + 1,
        cardId,
        opened: false,
        cardRevealed: false,
        interpretationStatus: "pending",
      })),
    };

    tx.update(userRef, {
      ...balances.after,
      [ACTIVE_FIELD]: series,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.set(transactionRef, {
      type: "yedi_gunluk_kehanet",
      amount: -price,
      before: balances.before,
      after: balances.after,
      meta: { requestId, deckType },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    result = {
      series: serializeSeries(series),
      charged: true,
      remainingCoin: balances.remainingTotalCoin,
    };
  });

  return result;
}

async function generateDailyInterpretation(series, dayNumber) {
  const day = series.days?.[dayNumber - 1];
  const card = cardFor(series.deckType, day?.cardId);
  if (!day || !card) {
    throw serviceError("Kart verisi bulunamadı", 500, "CARD_DATA_MISSING");
  }

  const deckLabel = series.deckType === "tarot" ? "Tarot" : "Melek";
  const deckContext =
    series.deckType === "tarot"
      ? "Tarot kartının sembolik enerjisini o günün olası temaları, dikkat noktaları ve fırsatları üzerinden yorumla."
      : "Melek kartının rehberlik ve destek mesajını o güne özel, sıcak ve ruhsal bir dille yorumla.";

  const timeout = new Promise((_, reject) =>
    setTimeout(
      () => reject(serviceError("Günlük yorum zaman aşımına uğradı", 504, "DAILY_INTERPRETATION_TIMEOUT")),
      45000,
    ),
  );

  const completion = await Promise.race([
    openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `Sen Arap Bacı uygulamasında 7 Günlük Kehanet için kısa günlük yorum yazan deneyimli bir fal yorumcususun. ${deckContext} Kullanıcıya doğrudan hitap et. Yalnız o güne odaklan. Kartın sözlük tanımını yazma. 2-4 kısa cümle ve en fazla 90 kelime kullan. Sağlık, hukuk, ölüm veya kesin gelecek iddiaları üretme. Markdown ve başlık kullanma.`,
        },
        {
          role: "user",
          content: `Fal tipi: 7 Günlük Kehanet\nDeste: ${deckLabel}\nGün: ${dayNumber} / 7\nKart: ${cardName(card)}\n\nYalnız bu güne ait kısa kehanet yorumunu yaz.`,
        },
      ],
      temperature: 0.85,
    }),
    timeout,
  ]);

  const text = String(completion?.choices?.[0]?.message?.content || "").trim();
  if (!text) {
    throw serviceError(
      "Günlük yorum oluşturulamadı",
      502,
      "DAILY_INTERPRETATION_FAILED",
    );
  }
  return text;
}

async function generateGeneralInterpretation(series) {
  if (!allDailyInterpretationsComplete(series)) {
    throw serviceError(
      "Tüm günlük yorumlar tamamlanmadan genel yorum oluşturulamaz",
      409,
      "DAILY_INTERPRETATIONS_INCOMPLETE",
    );
  }

  const orderedCards = series.days.map((day) => {
    const card = cardFor(series.deckType, day.cardId);
    if (!card) {
      throw serviceError("Kart verisi bulunamadı", 500, "CARD_DATA_MISSING");
    }
    return `Gün ${day.day}:\nKart: ${cardName(card)}\nGünlük yorum: ${dailyInterpretation(day)}`;
  });

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content:
          "Sen Arap Bacı uygulamasında yedi günlük kart serisini yorumlayan deneyimli bir fal yorumcususun. Yalnız verilen kartları, kayıtlı günlük yorumları ve gün sırasını kullan. Türkçe, bütünlüklü, sıcak ama kesin hüküm vermeyen bir genel yorum yaz.",
      },
      {
        role: "user",
        content: `Fal tipi: 7 Günlük Kehanet\nDeste: ${series.deckType === "tarot" ? "Tarot" : "Melek"}\n\n${orderedCards.join("\n\n")}\n\nYedi günün tamamını ve günlük yorumların gelişimini sırayla bağlayan kapsamlı genel yorumu oluştur.`,
      },
    ],
  });

  const text = String(completion.choices?.[0]?.message?.content || "").trim();
  if (!text) {
    throw serviceError(
      "Genel yorum oluşturulamadı",
      502,
      "GENERAL_INTERPRETATION_FAILED",
    );
  }
  return text;
}

async function claimGeneralGeneration(userRef, seriesId) {
  let claimedSeries;

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const series = userSnap.data()?.[ACTIVE_FIELD];
    if (!series || series.id !== seriesId) {
      throw serviceError("Aktif seri bulunamadı", 404, "ACTIVE_SERIES_NOT_FOUND");
    }

    if (series.generalInterpretation) {
      claimedSeries = series;
      return;
    }

    if (!allDailyInterpretationsComplete(series)) {
      throw serviceError(
        "Tüm günlük yorumlar tamamlanmadan genel yorum oluşturulamaz",
        409,
        "DAILY_INTERPRETATIONS_INCOMPLETE",
      );
    }

    const nowMs = Date.now();
    if (
      series.status === "generating_general" &&
      nowMs - Number(series.generalGenerationStartedAtMs || 0) < GENERAL_LOCK_MS
    ) {
      throw serviceError(
        "Genel yorum hazırlanıyor",
        409,
        "GENERAL_INTERPRETATION_PROCESSING",
      );
    }

    const claimed = {
      ...series,
      status: "generating_general",
      generalGenerationStartedAtMs: nowMs,
    };
    tx.update(userRef, { [ACTIVE_FIELD]: claimed });
    claimedSeries = claimed;
  });

  return claimedSeries;
}

async function saveDailyInterpretation({
  userRef,
  seriesId,
  dayNumber,
  interpretation,
  generationStartedAtMs,
}) {
  let savedSeries;

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const series = userSnap.data()?.[ACTIVE_FIELD];
    if (!series || series.id !== seriesId) {
      throw serviceError("Aktif seri bulunamadı", 404, "ACTIVE_SERIES_NOT_FOUND");
    }

    const day = series.days?.[dayNumber - 1];
    if (!day) {
      throw serviceError("Gün verisi bulunamadı", 500, "DAY_DATA_MISSING");
    }

    if (isDailyComplete(day)) {
      savedSeries = series;
      return;
    }

    if (
      day.interpretationStatus !== "processing" ||
      Number(day.interpretationStartedAtMs || 0) !== generationStartedAtMs
    ) {
      throw serviceError(
        "Günlük yorum işlemi değişti",
        409,
        "DAILY_INTERPRETATION_STATE_CHANGED",
      );
    }

    savedSeries = completeDailyInterpretation(
      series,
      dayNumber,
      interpretation,
      Date.now(),
    );
    tx.update(userRef, { [ACTIVE_FIELD]: savedSeries });
  });

  return savedSeries;
}

async function restoreDailyPending({
  userRef,
  seriesId,
  dayNumber,
  generationStartedAtMs,
}) {
  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const series = userSnap.data()?.[ACTIVE_FIELD];
    if (!series || series.id !== seriesId) return;

    const day = series.days?.[dayNumber - 1];
    if (
      !day ||
      day.interpretationStatus !== "processing" ||
      Number(day.interpretationStartedAtMs || 0) !== generationStartedAtMs
    ) {
      return;
    }

    tx.update(userRef, {
      [ACTIVE_FIELD]: resetDailyInterpretation(series, dayNumber, Date.now()),
    });
  });
}

async function saveGeneralInterpretation({
  userRef,
  seriesId,
  interpretation,
  generationStartedAtMs,
}) {
  const clean = String(interpretation || "").trim();
  if (!clean) {
    throw serviceError(
      "Genel yorum oluşturulamadı",
      502,
      "GENERAL_INTERPRETATION_FAILED",
    );
  }

  let savedSeries;
  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const series = userSnap.data()?.[ACTIVE_FIELD];
    if (!series || series.id !== seriesId) {
      throw serviceError("Aktif seri bulunamadı", 404, "ACTIVE_SERIES_NOT_FOUND");
    }

    if (series.generalInterpretation) {
      savedSeries = series;
      return;
    }

    if (
      series.status !== "generating_general" ||
      Number(series.generalGenerationStartedAtMs || 0) !== generationStartedAtMs
    ) {
      throw serviceError(
        "Genel yorum işlemi değişti",
        409,
        "GENERAL_INTERPRETATION_STATE_CHANGED",
      );
    }

    savedSeries = completeGeneralInterpretation(series, clean, Date.now());
    tx.update(userRef, { [ACTIVE_FIELD]: savedSeries });
  });

  return savedSeries;
}

async function completeSeries(userRef, series, interpretation) {
  const cleanInterpretation = String(interpretation || "").trim();
  if (!cleanInterpretation || !allDailyInterpretationsComplete(series)) {
    throw serviceError(
      "Seri tamamlanma koşulları sağlanmadı",
      409,
      "SERIES_NOT_READY",
    );
  }

  const historyRef = userRef
    .collection("history")
    .doc(operationDocumentId("yedi_gunluk", series.id));
  let completed;

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const current = userSnap.data()?.[ACTIVE_FIELD];
    if (!current || current.id !== series.id) {
      const historySnap = await tx.get(historyRef);
      if (historySnap.exists) {
        completed = historySnap.data()?.series || null;
        return;
      }
      throw serviceError("Aktif seri bulunamadı", 404, "ACTIVE_SERIES_NOT_FOUND");
    }

    if (!allDailyInterpretationsComplete(current)) {
      throw serviceError(
        "Tüm günlük yorumlar tamamlanmadı",
        409,
        "DAILY_INTERPRETATIONS_INCOMPLETE",
      );
    }

    const completedAtMs = Date.now();
    completed = {
      ...current,
      status: "completed",
      generalInterpretation: cleanInterpretation,
      completedAtMs,
    };

    tx.set(historyRef, {
      type: "yedi_gunluk_kehanet",
      interpretation: cleanInterpretation,
      deckType: completed.deckType,
      startDate: completed.startDateKey,
      cards: completed.days.map((day) => {
        const card = cardFor(completed.deckType, day.cardId);
        return {
          day: day.day,
          id: day.cardId,
          name: cardName(card),
          image: card?.image || null,
          openedAtMs: day.openedAtMs || null,
          shortInterpretation: dailyInterpretation(day),
        };
      }),
      cardImages: completed.days.map(
        (day) => cardFor(completed.deckType, day.cardId)?.image || "",
      ),
      series: completed,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAtMs,
      favorite: false,
    });

    tx.update(userRef, {
      [ACTIVE_FIELD]: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return completed;
}

async function restorePendingStatus(userRef, seriesId, generationStartedAtMs) {
  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const series = userSnap.data()?.[ACTIVE_FIELD];
    if (
      !series ||
      series.id !== seriesId ||
      series.generalInterpretation ||
      series.status !== "generating_general" ||
      Number(series.generalGenerationStartedAtMs || 0) !== generationStartedAtMs
    ) {
      return;
    }

    tx.update(userRef, {
      [ACTIVE_FIELD]: resetGeneralInterpretation(series, Date.now()),
    });
  });
}

export async function revealSevenDay(uid, body) {
  const requestedDay = Number.parseInt(body?.day, 10);
  if (!Number.isInteger(requestedDay) || requestedDay < 1 || requestedDay > 7) {
    throw serviceError("Geçersiz gün", 400, "INVALID_DAY");
  }

  const userRef = db.collection("users").doc(uid);
  let action = "cached";
  let claimedSeries;
  let dailyGenerationStartedAtMs = null;

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) {
      throw serviceError("Kullanıcı bulunamadı", 404, "USER_NOT_FOUND");
    }

    const series = userSnap.data()?.[ACTIVE_FIELD];
    if (!series) {
      throw serviceError("Aktif seri bulunamadı", 404, "ACTIVE_SERIES_NOT_FOUND");
    }

    const day = series.days?.[requestedDay - 1];
    if (!day) {
      throw serviceError("Gün verisi bulunamadı", 500, "DAY_DATA_MISSING");
    }

    if (isDailyComplete(day)) {
      claimedSeries = series;
      const generalProcessingFresh =
        series.status === "generating_general" &&
        Date.now() - Number(series.generalGenerationStartedAtMs || 0) <
          GENERAL_LOCK_MS;
      if (
        requestedDay === 7 &&
        allDailyInterpretationsComplete(series) &&
        !generalProcessingFresh
      ) {
        action = "general";
      }
      return;
    }

    const nextDay = nextIncompleteDay(series);
    if (requestedDay !== nextDay) {
      throw serviceError(
        "Kartlar gün sırasıyla açılmalıdır",
        409,
        "DAY_ORDER_LOCKED",
      );
    }

    if (requestedDay > unlockedDay(series)) {
      throw serviceError(
        "Bu kartın takvim günü henüz gelmedi",
        409,
        "DAY_NOT_UNLOCKED",
      );
    }

    const nowMs = Date.now();
    if (isDailyProcessingFresh(day, nowMs)) {
      throw serviceError(
        "Günlük yorum hazırlanıyor",
        409,
        "DAILY_INTERPRETATION_PROCESSING",
      );
    }

    if (!cardFor(series.deckType, day.cardId)) {
      throw serviceError("Kart verisi bulunamadı", 500, "CARD_DATA_MISSING");
    }

    dailyGenerationStartedAtMs = nowMs;
    claimedSeries = {
      ...claimDailyInterpretation(series, requestedDay, nowMs),
      status: "active",
    };
    action = "daily";
    tx.update(userRef, { [ACTIVE_FIELD]: claimedSeries });
  });

  if (action === "cached") {
    return { series: serializeSeries(claimedSeries) };
  }

  if (action === "daily") {
    try {
      const dailyText = await generateDailyInterpretation(
        claimedSeries,
        requestedDay,
      );
      claimedSeries = await saveDailyInterpretation({
        userRef,
        seriesId: claimedSeries.id,
        dayNumber: requestedDay,
        interpretation: dailyText,
        generationStartedAtMs: dailyGenerationStartedAtMs,
      });
    } catch (error) {
      try {
        await restoreDailyPending({
          userRef,
          seriesId: claimedSeries.id,
          dayNumber: requestedDay,
          generationStartedAtMs: dailyGenerationStartedAtMs,
        });
      } catch (restoreError) {
        console.error("7 GÜNLÜK DAILY STATUS RESTORE ERROR:", restoreError);
      }
      throw error;
    }

    if (requestedDay < 7) {
      return { series: serializeSeries(claimedSeries) };
    }

    action = "general";
  }

  let generalClaimed;
  let generalSaved;
  try {
    generalClaimed = await claimGeneralGeneration(userRef, claimedSeries.id);

    if (generalClaimed.generalInterpretation) {
      const completed = await completeSeries(
        userRef,
        generalClaimed,
        generalClaimed.generalInterpretation,
      );
      return { series: serializeSeries(completed) };
    }

    const interpretation = await generateGeneralInterpretation(generalClaimed);
    generalSaved = await saveGeneralInterpretation({
      userRef,
      seriesId: generalClaimed.id,
      interpretation,
      generationStartedAtMs: generalClaimed.generalGenerationStartedAtMs,
    });
    const completed = await completeSeries(
      userRef,
      generalSaved,
      generalSaved.generalInterpretation,
    );
    return { series: serializeSeries(completed) };
  } catch (error) {
    if (generalClaimed && !generalSaved && !generalClaimed.generalInterpretation) {
      try {
        await restorePendingStatus(
          userRef,
          generalClaimed.id,
          generalClaimed.generalGenerationStartedAtMs,
        );
      } catch (restoreError) {
        console.error("7 GÜNLÜK STATUS RESTORE ERROR:", restoreError);
      }
    }
    throw error;
  }
}
