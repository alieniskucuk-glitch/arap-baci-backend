export const DAILY_INTERPRETATION_LOCK_MS = 2 * 60 * 1000;

export function operationDocumentId(prefix, requestId) {
  return `${prefix}_${requestId}`;
}

export function niyetResponseFromDocument(data, { charged } = {}) {
  return {
    success: true,
    requestId: data.requestId,
    animal: data.animal,
    result: {
      id: data.resultId,
      theme: data.resultTheme,
      text: data.interpretation,
    },
    remainingCoin: data.remainingCoin,
    charged: charged ?? data.charged === true,
  };
}

export function dailyInterpretation(day) {
  return String(day?.dailyInterpretation || "").trim();
}

export function isDailyComplete(day) {
  return day?.opened === true && dailyInterpretation(day).length > 0;
}

export function nextIncompleteDay(series) {
  const index = (series?.days || []).findIndex(
    (day) => !isDailyComplete(day),
  );
  return index === -1 ? null : index + 1;
}

export function isDailyProcessingFresh(day, nowMs = Date.now()) {
  return (
    day?.interpretationStatus === "processing" &&
    nowMs - Number(day?.interpretationStartedAtMs || 0) <
      DAILY_INTERPRETATION_LOCK_MS
  );
}

export function claimDailyInterpretation(series, dayNumber, nowMs) {
  return {
    ...series,
    days: series.days.map((day, index) =>
      index === dayNumber - 1
        ? {
            ...day,
            opened: false,
            cardRevealed: true,
            interpretationStatus: "processing",
            interpretationStartedAtMs: nowMs,
          }
        : day,
    ),
  };
}

export function completeDailyInterpretation(
  series,
  dayNumber,
  interpretation,
  openedAtMs,
) {
  const clean = String(interpretation || "").trim();
  if (!clean) throw new Error("Günlük yorum boş olamaz");

  return {
    ...series,
    days: series.days.map((day, index) =>
      index === dayNumber - 1
        ? {
            ...day,
            opened: true,
            cardRevealed: true,
            dailyInterpretation: clean,
            interpretationStatus: "complete",
            openedAtMs,
          }
        : day,
    ),
  };
}

export function resetDailyInterpretation(series, dayNumber, failedAtMs) {
  return {
    ...series,
    days: series.days.map((day, index) =>
      index === dayNumber - 1
        ? {
            ...day,
            opened: false,
            cardRevealed: true,
            interpretationStatus: "pending",
            interpretationFailedAtMs: failedAtMs,
          }
        : day,
    ),
  };
}

export function allDailyInterpretationsComplete(series) {
  return (
    Array.isArray(series?.days) &&
    series.days.length === 7 &&
    series.days.every(isDailyComplete)
  );
}

export function completeGeneralInterpretation(series, interpretation, createdAtMs) {
  const clean = String(interpretation || "").trim();
  if (!clean) throw new Error("Genel yorum boş olamaz");

  return {
    ...series,
    status: "general_ready",
    generalInterpretation: clean,
    generalInterpretationCreatedAtMs: createdAtMs,
  };
}

export function resetGeneralInterpretation(series, failedAtMs) {
  return {
    ...series,
    status: "general_pending",
    generalGenerationFailedAtMs: failedAtMs,
  };
}
