import assert from "node:assert/strict";
import test from "node:test";

import {
  allDailyInterpretationsComplete,
  claimDailyInterpretation,
  completeDailyInterpretation,
  completeGeneralInterpretation,
  isDailyComplete,
  isDailyProcessingFresh,
  nextIncompleteDay,
  niyetResponseFromDocument,
  operationDocumentId,
  resetDailyInterpretation,
  resetGeneralInterpretation,
} from "../utils/fortuneState.js";

function seriesWithSevenDays() {
  return {
    id: "series_1",
    status: "active",
    days: Array.from({ length: 7 }, (_, index) => ({
      day: index + 1,
      cardId: index + 10,
      opened: false,
      cardRevealed: false,
      interpretationStatus: "pending",
    })),
  };
}

test("aynı Niyet requestId aynı belgeyi ve kayıtlı sonucu kullanır", () => {
  const requestId = "request_123";
  assert.equal(
    operationDocumentId("niyet", requestId),
    operationDocumentId("niyet", requestId),
  );

  const stored = {
    requestId,
    animal: "baykus",
    resultId: "ortak_001",
    resultTheme: "haber",
    interpretation: "Kayıtlı sonuç",
    remainingCoin: 9,
    charged: true,
  };
  const first = niyetResponseFromDocument(stored);
  const retry = niyetResponseFromDocument(stored, { charged: false });

  assert.deepEqual(retry.result, first.result);
  assert.equal(first.charged, true);
  assert.equal(retry.charged, false);
});

test("günlük yorum processing kilidi aynı gün ikinci üretimi engeller", () => {
  const now = 1_000_000;
  const original = seriesWithSevenDays();
  const claimed = claimDailyInterpretation(original, 1, now);

  assert.equal(isDailyComplete(claimed.days[0]), false);
  assert.equal(claimed.days[0].cardId, original.days[0].cardId);
  assert.equal(claimed.days[0].cardRevealed, true);
  assert.equal(isDailyProcessingFresh(claimed.days[0], now + 1_000), true);
  assert.equal(nextIncompleteDay(claimed), 1);
});

test("günlük API hatası günü tamamlamaz ve aynı kartla retry yapılabilir", () => {
  const original = seriesWithSevenDays();
  const claimed = claimDailyInterpretation(original, 1, 1_000);
  const failed = resetDailyInterpretation(claimed, 1, 2_000);

  assert.equal(isDailyComplete(failed.days[0]), false);
  assert.equal(failed.days[0].interpretationStatus, "pending");
  assert.equal(failed.days[0].cardId, original.days[0].cardId);

  const retried = claimDailyInterpretation(failed, 1, 3_000);
  const completed = completeDailyInterpretation(
    retried,
    1,
    "Bugüne özel kayıtlı yorum",
    4_000,
  );
  assert.equal(isDailyComplete(completed.days[0]), true);
  assert.equal(completed.days[0].cardId, original.days[0].cardId);
  assert.equal(completed.days[0].dailyInterpretation, "Bugüne özel kayıtlı yorum");
  assert.equal(nextIncompleteDay(completed), 2);
});

test("genel yorum ancak yedi günlük yorum tamamlanınca hazır olabilir", () => {
  let series = seriesWithSevenDays();
  for (let day = 1; day <= 6; day += 1) {
    series = completeDailyInterpretation(series, day, `Yorum ${day}`, day);
  }
  assert.equal(allDailyInterpretationsComplete(series), false);

  series = completeDailyInterpretation(series, 7, "Yorum 7", 7);
  assert.equal(allDailyInterpretationsComplete(series), true);
});

test("genel yorum hatası Gün 7 yorumunu korur, retry yalnız geneli tamamlar", () => {
  let series = seriesWithSevenDays();
  for (let day = 1; day <= 7; day += 1) {
    series = completeDailyInterpretation(series, day, `Yorum ${day}`, day);
  }

  const daySevenBefore = { ...series.days[6] };
  const pending = resetGeneralInterpretation(
    { ...series, status: "generating_general" },
    8,
  );
  assert.deepEqual(pending.days[6], daySevenBefore);
  assert.equal(pending.status, "general_pending");

  const ready = completeGeneralInterpretation(pending, "Genel yorum", 9);
  assert.deepEqual(ready.days[6], daySevenBefore);
  assert.equal(ready.generalInterpretation, "Genel yorum");
  assert.equal(ready.status, "general_ready");
});

test("tamamlanmış seri için history belge kimliği deterministiktir", () => {
  const first = operationDocumentId("yedi_gunluk", "series_1");
  const retry = operationDocumentId("yedi_gunluk", "series_1");
  const other = operationDocumentId("yedi_gunluk", "series_2");

  assert.equal(first, retry);
  assert.notEqual(first, other);
});
