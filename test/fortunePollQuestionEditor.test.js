import assert from "node:assert/strict";
import test from "node:test";

import {
  FORTUNE_POLL_QUESTION_EDITOR_PROMPT,
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

test("AI3 soyut ilişki kararını somut davranışa dönüştürme kuralını taşır", async () => {
  const relationshipSeed = {
    hasPollSeed: true,
    candidates: [{
      candidateId: "c1",
      lifeArea: "mevcut ilişki",
      subject: "mevcut romantik bağ",
      topic: "durağan bağda yeniden yakınlaşma",
      signal: "açık iletişim ve yeniden yakınlaşma fırsatı",
      decisionFrame: "ilişkiye yeniden şans verme kararı",
      specificity: "specific",
      strength: "high",
    }],
  };
  const relationshipWriter = {
    selectedCandidateId: "c1",
    subject: "mevcut romantik bağ",
    scenarioBasis: "durağan ilişkide yeniden yakınlaşma ve açık iletişim fırsatı",
    decisionAction: "ilişkiye yeniden şans vermek",
    question: "Falımda uzun süredir durağan kalan mevcut romantik bağımda yeniden bir yakınlaşma ve açık iletişim fırsatı görünüyor. Böyle bir durumda, bu ilişkiye yeniden enerji verip bir adım daha atmalı mıyım?",
  };
  const finalQuestion = "Falımda uzun süredir durağan kalan mevcut romantik bağımda yeniden bir yakınlaşma ve açık iletişim fırsatı görünüyor. Bu ilişkiyi yeniden canlandırmak için karşı tarafla açıkça konuşup ilişkiye yeniden şans vermeli miyim?";
  const mock = createClient({
    status: "pass",
    selectedCandidateId: "c1",
    subject: relationshipWriter.subject,
    decisionAction: relationshipWriter.decisionAction,
    question: finalQuestion,
  });

  const result = await editFortunePollQuestion({
    fortuneText: relationshipWriter.question,
    seed: relationshipSeed,
    writer: relationshipWriter,
    openaiClient: mock.client,
  });

  assert.equal(result.question, finalQuestion);
  assert.match(FORTUNE_POLL_QUESTION_EDITOR_PROMPT, /SOMUT DAVRANIŞA DÖNÜŞTÜRME KURALI/);
  assert.match(FORTUNE_POLL_QUESTION_EDITOR_PROMPT, /gerçek hayatta TAM OLARAK ne yapmasını öneriyor/);
});

test("AI3 yapay ve tekrarlı ilişki metnini doğal anlam akışına dönüştürme kuralını taşır", async () => {
  const relationshipSeed = {
    hasPollSeed: true,
    candidates: [{
      candidateId: "c1",
      lifeArea: "mevcut ilişki",
      subject: "mevcut romantik bağ",
      topic: "mesafe ve iletişim kopukluğuna rağmen yeniden yakınlaşma",
      signal: "açık iletişim ve yeniden yakınlaşma ihtimali",
      decisionFrame: "ilişkiye yeniden şans verme kararı",
      specificity: "specific",
      strength: "high",
    }],
  };
  const relationshipWriter = {
    selectedCandidateId: "c1",
    subject: "mevcut romantik bağ",
    scenarioBasis: "mesafe ve iletişim kopukluğuna rağmen yeniden yakınlaşma ihtimali",
    decisionAction: "ilişkiye yeniden şans vermek",
    question: "Fincanım, aramızdaki mesafe ve iletişim kopukluğu açık konuşarak aşılabilecek bir dönemi gösteriyor; ben de ilişkiyi sürdürmek için karşı tarafla açıkça konuşup ilişkiye yeniden şans vermeli miyim?",
  };
  const finalQuestion = "Fincanım, aramızdaki mesafe ve iletişim kopukluğuna rağmen yeniden yakınlaşma ihtimali olduğunu gösteriyor. Karşı tarafla açıkça konuşup bu ilişkiye yeniden şans vermeli miyim?";
  const mock = createClient({
    status: "pass",
    selectedCandidateId: "c1",
    subject: relationshipWriter.subject,
    decisionAction: relationshipWriter.decisionAction,
    question: finalQuestion,
  });

  const result = await editFortunePollQuestion({
    fortuneText: relationshipWriter.question,
    seed: relationshipSeed,
    writer: relationshipWriter,
    openaiClient: mock.client,
  });

  assert.equal(result.question, finalQuestion);
  assert.match(FORTUNE_POLL_QUESTION_EDITOR_PROMPT, /ANLAM AKIŞI VE TEKRAR KONTROLÜ/);
  assert.match(FORTUNE_POLL_QUESTION_EDITOR_PROMPT, /Noktalı virgülle iki düşünceyi zorla birleştirme/);
  assert.match(FORTUNE_POLL_QUESTION_EDITOR_PROMPT, /İlk cümlede anlatılan durum, son cümlede sorulan karara doğal olarak yol açıyor mu/);
});

test("AI3 mevcut ilişki subject'ini genel aşk hayatına dönüştürmeden açık referansla kurar", async () => {
  const relationshipSeed = {
    hasPollSeed: true,
    candidates: [{
      candidateId: "c1",
      lifeArea: "aşk",
      subject: "mevcut ilişki",
      topic: "inişli çıkışlı ilişki dinamiği ve toparlanma ihtimali",
      signal: "duyguları açıkça ifade ederek yeniden yakınlaşma ihtimali",
      decisionFrame: "mevcut ilişkiye yeniden şans verme kararı",
      specificity: "specific",
      strength: "high",
    }],
  };
  const relationshipWriter = {
    selectedCandidateId: "c1",
    subject: "mevcut ilişki",
    scenarioBasis: "inişli çıkışlı ilişki dinamiği ve toparlanma ihtimali",
    decisionAction: "mevcut ilişkiye yeniden şans vermek",
    question: "Aşk hayatımda inişli çıkışlı ama toparlanmaya açık bir dönem görünüyor. Duygularımı açıkça ifade edip bu ilişkiye gerçekten bir şans vermeli miyim?",
  };
  const finalQuestion = "Mevcut ilişkimde inişli çıkışlı ama toparlanmaya açık bir dönem görünüyor. Duygularımı açıkça ifade edip bu ilişkiye gerçekten bir şans vermeli miyim?";
  const mock = createClient({
    status: "pass",
    selectedCandidateId: "c1",
    subject: relationshipWriter.subject,
    decisionAction: relationshipWriter.decisionAction,
    question: finalQuestion,
  });

  const result = await editFortunePollQuestion({
    fortuneText: relationshipWriter.question,
    seed: relationshipSeed,
    writer: relationshipWriter,
    openaiClient: mock.client,
  });

  assert.equal(result.question, finalQuestion);
  assert.equal(result.subject, "mevcut ilişki");
  assert.match(result.question, /^Mevcut ilişkimde /);
  assert.doesNotMatch(result.question, /^Aşk hayatımda /);
  assert.match(FORTUNE_POLL_QUESTION_EDITOR_PROMPT, /SUBJECT VE REFERANS TUTARLILIĞI ZORUNLUDUR/);
  assert.match(FORTUNE_POLL_QUESTION_EDITOR_PROMPT, /Bu ilişki hangisi/);
  assert.match(FORTUNE_POLL_QUESTION_EDITOR_PROMPT, /genel hayat alanına kaçmış mı/);
});
