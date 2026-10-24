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
    subject: "yeni kariyer projesi",
    topic: "yeni proje",
    signal: "iş hayatında yeni proje işareti",
    decisionFrame: "yeni kariyer projesini üstlenme kararı",
    specificity: "specific",
    strength: "high",
  }],
};

const writer = {
  selectedCandidateId: "c1",
  subject: "yeni kariyer projesi",
  scenarioBasis: "iş hayatında yeni kariyer projesinin öne çıkması",
  decisionAction: "yeni kariyer projesini üstlenmek",
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
    status: "pass",
    selectedCandidateId: "c1",
    subject: writer.subject,
    decisionAction: writer.decisionAction,
    question: "Yeni kariyer projesi karşıma çıkarsa mevcut düzenimi değiştirip onu üstlenmeli miyim?",
  });
  const result = await editFortunePollQuestion({
    fortuneText: "İş hayatında yeni bir proje öne çıkıyor.", seed, writer,
    falId: "safe-fal-id", openaiClient: mock.client,
  });
  assert.deepEqual(result, {
    status: "pass",
    selectedCandidateId: "c1",
    subject: writer.subject,
    decisionAction: writer.decisionAction,
    question: "Yeni kariyer projesi karşıma çıkarsa mevcut düzenimi değiştirip onu üstlenmeli miyim?",
  });
  assert.equal(mock.requests[0].model, "gpt-5.4-mini");
  assert.equal(mock.requests[0].max_output_tokens, 450);
});

test("AI3 aday kimliğini değiştirirse structural failure verir", async () => {
  const mock = createClient({ status: "pass", selectedCandidateId: "c2", subject: writer.subject, decisionAction: writer.decisionAction, question: "Başka aday sorusu" });
  await assert.rejects(
    editFortunePollQuestion({
      fortuneText: "İş hayatında yeni bir proje öne çıkıyor.", seed, writer,
      openaiClient: mock.client,
    }),
  );
});

test("AI3 girdisi falı, tohumları ve seçilmiş taslağı içerir", () => {
  assert.equal(
    buildUserMessage("Fal metni", seed, writer),
    `FAL YORUMU:\n\nFal metni\n\nANKET TOHUMLARI:\n\n${JSON.stringify(seed)}\n\nSEÇİLMİŞ ANKET TASLAĞI:\n\n${JSON.stringify(writer)}`,
  );
});
