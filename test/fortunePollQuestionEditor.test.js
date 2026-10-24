import assert from "node:assert/strict";
import test from "node:test";

import {
  buildUserMessage,
  editFortunePollQuestion,
} from "../services/fortunePollQuestionEditor.js";

const seed = {
  hasPollSeed: true,
  candidates: [{
    candidateId: "c1",
    lifeArea: "kariyer",
    topic: "yeni proje",
    signal: "iş hayatında yeni proje işareti",
    decisionPotential: "yeni projeyi üstlenme tercihi",
    specificity: "specific",
    strength: "high",
  }],
};

const writer = {
  selectedCandidateId: "c1",
  question: "Kariyerimde karşıma çıkabilecek yeni projeyi üstlenmeli miyim?",
};

function createClient(output) {
  const requests = [];
  return {
    requests,
    client: { responses: { create: async (request) => {
      requests.push(request);
      return { output_text: JSON.stringify(output) };
    } } },
  };
}

test("AI3 seçilen aday kimliğini ve nihai soruyu döndürür", async () => {
  const mock = createClient({
    selectedCandidateId: "c1",
    question: "Yeni kariyer projesi karşıma çıkarsa mevcut düzenimi değiştirip onu üstlenmeli miyim?",
  });
  const result = await editFortunePollQuestion({
    fortuneText: "İş hayatında yeni bir proje öne çıkıyor.", seed, writer,
    falId: "safe-fal-id", openaiClient: mock.client,
  });
  assert.deepEqual(result, {
    selectedCandidateId: "c1",
    question: "Yeni kariyer projesi karşıma çıkarsa mevcut düzenimi değiştirip onu üstlenmeli miyim?",
    usedFallback: false,
  });
  assert.equal(mock.requests[0].model, "gpt-5.4-mini");
  assert.equal(mock.requests[0].max_output_tokens, 350);
});

test("AI3 aday kimliğini değiştirirse AI2 taslağı fallback olarak korunur", async () => {
  const mock = createClient({ selectedCandidateId: "c2", question: "Başka aday sorusu" });
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const result = await editFortunePollQuestion({
      fortuneText: "İş hayatında yeni bir proje öne çıkıyor.", seed, writer,
      falId: "safe-fal-id", openaiClient: mock.client,
    });
    assert.deepEqual(result, { ...writer, usedFallback: true });
  } finally {
    console.warn = originalWarn;
  }
});

test("AI3 girdisi falı, tohumları ve seçilmiş taslağı içerir", () => {
  assert.equal(
    buildUserMessage("Fal metni", seed, writer),
    `FAL YORUMU:\n\nFal metni\n\nANKET TOHUMLARI:\n\n${JSON.stringify(seed)}\n\nSEÇİLMİŞ ANKET TASLAĞI:\n\n${JSON.stringify(writer)}`,
  );
});
