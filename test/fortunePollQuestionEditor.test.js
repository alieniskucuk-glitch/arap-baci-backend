import assert from "node:assert/strict";
import test from "node:test";

import {
  editFortunePollDilemma,
  editFortunePollQuestion,
} from "../services/fortunePollQuestionEditor.js";

function createEditorClient({ question, error } = {}) {
  const requests = [];

  return {
    requests,
    client: {
      responses: {
        create: async (request) => {
          requests.push(request);

          if (error) {
            throw error;
          }

          return {
            output_text: JSON.stringify({ question }),
          };
        },
      },
    },
  };
}

async function editWithMock({ fortuneText, initialQuestion, editedQuestion }) {
  const mock = createEditorClient({ question: editedQuestion });
  const result = await editFortunePollQuestion({
    fortuneText,
    question: initialQuestion,
    falId: "safe-fal-id",
    openaiClient: mock.client,
  });

  return { result, request: mock.requests[0] };
}

test("editör yüzeysel yolculuk sorusunu senaryo ve karara dönüştürür", async () => {
  const initialQuestion = "Yakın zamanda çıkabilecek bir yolculuğa gitmeli miyim?";
  const editedQuestion =
    "Falım yakında hayatımın akışını değiştirebilecek bir yolculuğa işaret ediyor. Böyle bir fırsat karşıma çıkarsa düzenimi bozup bu yolculuğa çıkmalı mıyım?";
  const { result, request } = await editWithMock({
    fortuneText:
      "Yakında hayatımın akışını değiştirebilecek önemli bir yol görünüyor.",
    initialQuestion,
    editedQuestion,
  });

  assert.equal(result, editedQuestion);
  assert.equal(request.model, "gpt-5.4-mini");
  assert.equal(request.max_output_tokens, 250);
  assert.equal(
    request.input[1].content[0].text,
    `FAL YORUMU:\n\nYakında hayatımın akışını değiştirebilecek önemli bir yol görünüyor.\n\nİLK ANKET SORUSU:\n\n${initialQuestion}`,
  );
});

test("editör kariyer değişimini daha güçlü bir senaryo ve karara dönüştürür", async () => {
  const { result } = await editWithMock({
    fortuneText: "Kariyerimde yeni ve riskli bir fırsatın yaklaştığı görülüyor.",
    initialQuestion: "İş hayatımdaki yeni değişimi değerlendirmeli miyim?",
    editedQuestion:
      "Falım kariyerimde yeni ve riskli bir fırsatın yaklaştığını söylüyor. Böyle bir teklif gelirse mevcut düzenimi bırakıp yeni bir başlangıç yapmalı mıyım?",
  });

  assert.equal(
    result,
    "Falım kariyerimde yeni ve riskli bir fırsatın yaklaştığını söylüyor. Böyle bir teklif gelirse mevcut düzenimi bırakıp yeni bir başlangıç yapmalı mıyım?",
  );
});

test("editör geçmişten gelen kişiyi yeniden görüşme kararına dönüştürür", async () => {
  const { result } = await editWithMock({
    fortuneText: "Geçmişten biri yeniden gündeme gelebilir.",
    initialQuestion: "Geçmişten biri hayatıma yeniden girer mi?",
    editedQuestion:
      "Falım geçmişten birinin yeniden hayatıma girmek istediğini gösteriyor. Eski sevgilim barışmak için geri dönerse ona ikinci bir şans vermeli miyim?",
  });

  assert.equal(
    result,
    "Falım geçmişten birinin yeniden hayatıma girmek istediğini gösteriyor. Eski sevgilim barışmak için geri dönerse ona ikinci bir şans vermeli miyim?",
  );
});

test("editör yeni kişiyi net ve ilgi çekici bir karar sorusuna dönüştürür", async () => {
  const { result } = await editWithMock({
    fortuneText: "Aşk hayatımda yeni bir kişinin enerjisi belirginleşiyor.",
    initialQuestion: "Aşk hayatımda yeni bir adım atmalı mıyım?",
    editedQuestion:
      "Falım aşk hayatıma yeni birinin girebileceğini söylüyor. Bu kişi beklediğim tipten çok farklı olsa bile ona bir şans vermeli miyim?",
  });

  assert.equal(
    result,
    "Falım aşk hayatıma yeni birinin girebileceğini söylüyor. Bu kişi beklediğim tipten çok farklı olsa bile ona bir şans vermeli miyim?",
  );
});

test("editör ilk AI konusu zayıfsa falın daha güçlü kariyer konusunu seçebilir", async () => {
  const { result } = await editWithMock({
    fortuneText:
      "Kısa bir yol ihtimali görünse de kariyerimde belirleyici bir yeni görev öne çıkıyor.",
    initialQuestion: "Yakın zamanda çıkabilecek bir yolculuğa gitmeli miyim?",
    editedQuestion:
      "Falım iş hayatımda önemli bir görev değişikliğinin yaklaştığını söylüyor. Yeni görevi üstlenirsem mevcut düzenimi değiştirmeyi göze almalı mıyım?",
  });

  assert.equal(
    result,
    "Falım iş hayatımda önemli bir görev değişikliğinin yaklaştığını söylüyor. Yeni görevi üstlenirsem mevcut düzenimi değiştirmeyi göze almalı mıyım?",
  );
});

test("hasDilemma false ise ikinci AI çağrısı hiç yapılmaz", async () => {
  const mock = createEditorClient({ question: "Kullanılmamalı" });
  const dilemma = {
    hasDilemma: false,
    question: null,
    option1: null,
    option2: null,
  };

  const result = await editFortunePollDilemma({
    dilemma,
    fortuneText: "Anket konusu yok.",
    falId: "safe-fal-id",
    openaiClient: mock.client,
  });

  assert.equal(result, dilemma);
  assert.equal(mock.requests.length, 0);
});

test("AI hatasında ilk soru fallback olarak korunur", async () => {
  const initialQuestion = "Kariyerimde yeni bir alana yönelmeli miyim?";
  const mock = createEditorClient({ error: Object.assign(new Error("API unavailable"), { code: "API_ERROR" }) });
  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    const result = await editFortunePollQuestion({
      fortuneText: "Kariyerimde yön değişikliği gündemde.",
      question: initialQuestion,
      falId: "safe-fal-id",
      openaiClient: mock.client,
    });

    assert.equal(result, initialQuestion);
  } finally {
    console.warn = originalWarn;
  }
});

test("editör iki veya üç kısa cümlelik Anket metnini geçerli kabul eder", async () => {
  const longQuestion =
    "Falım yeni bir yolculuğun hayatımda önemli bir değişim yaratabileceğini söylüyor. Bu fırsat karşıma çıkarsa günlük düzenimi bırakıp yola çıkmalı mıyım? Böyle bir kararı vermeye hazır mıyım?";
  const { result } = await editWithMock({
    fortuneText: "Hayatımın akışını değiştirebilecek güçlü bir yol görünüyor.",
    initialQuestion: "Yolculuğa gitmeli miyim?",
    editedQuestion: longQuestion,
  });

  assert.equal(result, longQuestion);
});

test("bozuk veya boş editör JSON'u ilk soruya fallback eder", async () => {
  const initialQuestion = "Kariyerimde yeni bir alana yönelmeli miyim?";
  const mock = {
    responses: {
      create: async () => ({ output_text: '{"question":"   "}' }),
    },
  };
  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    const result = await editFortunePollQuestion({
      fortuneText: "Kariyerimde yön değişikliği gündemde.",
      question: initialQuestion,
      falId: "safe-fal-id",
      openaiClient: mock,
    });

    assert.equal(result, initialQuestion);
  } finally {
    console.warn = originalWarn;
  }
});
