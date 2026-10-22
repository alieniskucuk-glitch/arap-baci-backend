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

test("editör kötü kariyer sorusunu falın somut kararına göre baştan yazar", async () => {
  const initialQuestion = "İş hayatımdaki yeni değişimi değerlendirmeli miyim?";
  const editedQuestion = "Kariyerimde farklı bir alana yönelmeli miyim?";
  const { result, request } = await editWithMock({
    fortuneText:
      "Kariyerinde uzun süredir bulunduğun çizgiden farklı bir yöne kayma isteği belirginleşiyor.",
    initialQuestion,
    editedQuestion,
  });

  assert.equal(result, editedQuestion);
  assert.equal(request.model, "gpt-5.4-mini");
  assert.equal(request.max_output_tokens, 120);
  assert.equal(
    request.input[1].content[0].text,
    `FAL YORUMU:\n\nKariyerinde uzun süredir bulunduğun çizgiden farklı bir yöne kayma isteği belirginleşiyor.\n\nİLK ANKET SORUSU:\n\n${initialQuestion}`,
  );
});

test("editör gelecek tahmini olan kariyer sorusunu kişisel karara dönüştürür", async () => {
  const { result } = await editWithMock({
    fortuneText: "Kariyerimde farklı bir yöne ilerleme isteği öne çıkıyor.",
    initialQuestion:
      "Yakın zamanda kariyerinde yeni bir yön seçme ihtiyacı belirginleşecek mi?",
    editedQuestion: "Kariyerimde farklı bir alana yönelmeli miyim?",
  });

  assert.equal(result, "Kariyerimde farklı bir alana yönelmeli miyim?");
});

test("editör iki olasılığı kariyer görüşmesi kararına indirir", async () => {
  const { result } = await editWithMock({
    fortuneText: "Kariyerimde yaklaşan bir iş görüşmesi dikkat çekiyor.",
    initialQuestion:
      "Yakın zamanda gelecek bir görüşme veya teklifi kabul etmeli miyim?",
    editedQuestion: "Yaklaşan iş görüşmesine katılmalı mıyım?",
  });

  assert.equal(result, "Yaklaşan iş görüşmesine katılmalı mıyım?");
});

test("editör karar yöntemini gerçek tek karar nesnesine dönüştürür", async () => {
  const { result } = await editWithMock({
    fortuneText: "Geçmişten gelen bir kişinin yeniden yaklaşma ihtimali öne çıkıyor.",
    initialQuestion:
      "Aşk hayatımda yaşadığım ikilemde kalbimin sesini dinleyerek birini seçmeli miyim?",
    editedQuestion: "Geçmişten gelen kişiye yeniden şans vermeli miyim?",
  });

  assert.equal(result, "Geçmişten gelen kişiye yeniden şans vermeli miyim?");
});

test("editör kariyer fırsatını falda anlatılan projeyi üstlenme kararına çevirir", async () => {
  const { result } = await editWithMock({
    fortuneText: "Kariyerimde yeni bir proje ihtimali beliriyor.",
    initialQuestion: "Kariyerimdeki fırsatı değerlendirmeli miyim?",
    editedQuestion: "Karşıma çıkabilecek yeni projeyi üstlenmeli miyim?",
  });

  assert.equal(result, "Karşıma çıkabilecek yeni projeyi üstlenmeli miyim?");
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
