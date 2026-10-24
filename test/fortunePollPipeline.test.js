import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { FORTUNE_POLL_QUESTION_EDITOR_PROMPT, parseFortunePollEditor } from "../services/fortunePollQuestionEditor.js";
import { runFortunePollPipeline } from "../services/fortunePollPipeline.js";
import { parseFortunePollWriter } from "../services/fortunePollQuestionWriter.js";
import { FORTUNE_POLL_WRITER_PROMPT } from "../services/fortunePollQuestionWriter.js";
import { parseFortunePollSeed } from "../services/fortunePollSeedService.js";

const seed = {
  hasPollSeed: true,
  candidates: [
    { candidateId: "c1", lifeArea: "mevcut ilişki", subject: "mevcut partner", topic: "mevcut ilişkinin ciddileşmesi", signal: "ilişkide bağın derinleşmesi", decisionFrame: "mevcut ilişkiye devam etme kararı", specificity: "moderate", strength: "high" },
    { candidateId: "c2", lifeArea: "aşk", subject: "yeni romantik kişi", topic: "yeni bir kişinin hayatına girme ihtimali", signal: "yeni yakınlaşma işareti", decisionFrame: "yeni ilişkiye ciddi bir şans verme kararı", specificity: "moderate", strength: "medium" },
    { candidateId: "c3", lifeArea: "kariyer", subject: "yeni kariyer yönü", topic: "mevcut düzenden farklı kariyer yolu", signal: "iş hayatında yön değişikliği", decisionFrame: "farklı kariyer yönünü deneme kararı", specificity: "broad", strength: "medium" },
  ],
};

const writer = {
  selectedCandidateId: "c2",
  subject: "yeni romantik kişi",
  scenarioBasis: "yeni romantik kişinin hayatına girip ciddi yakınlaşma ihtimali oluşturması",
  decisionAction: "bu yeni ilişkiye ciddi bir şans vermek",
  question: "Yeni biriyle güçlü bir yakınlaşma oluşursa bu ilişkiye ciddi bir şans vermeli miyim?",
};

function client(outputs) {
  const calls = [];
  return {
    calls,
    responses: {
      create: async (request) => {
        calls.push(request);
        const next = outputs.shift();
        if (next instanceof Error) throw next;
        return { output_text: JSON.stringify(next) };
      },
    },
  };
}

function editorPass(question = "Yeni biriyle güçlü bir yakınlaşma oluşursa bu ilişkiye ciddi bir şans vermeli miyim?") {
  return { status: "pass", selectedCandidateId: writer.selectedCandidateId, subject: writer.subject, decisionAction: writer.decisionAction, question };
}

function editorReject() {
  return { status: "reject", selectedCandidateId: writer.selectedCandidateId, subject: writer.subject, decisionAction: writer.decisionAction, question: null };
}

test("AI 1 farklı ilişki senaryolarını ayrı candidate olarak kabul eder", () => {
  const parsed = parseFortunePollSeed({ ...seed, candidates: seed.candidates.slice(0, 2) });
  assert.equal(parsed.candidates[0].subject, "mevcut partner");
  assert.equal(parsed.candidates[1].subject, "yeni romantik kişi");
});

test("AI 1 iki yönlü decisionFrame'i reddeder", () => {
  assert.throws(() => parseFortunePollSeed({
    ...seed,
    candidates: [{ ...seed.candidates[0], decisionFrame: "mevcut ilişkide kalmak veya yeni kişiye şans vermek" }],
  }));
});

test("AI 2 selected candidate subject kilidini uygular", () => {
  assert.throws(() => parseFortunePollWriter({ ...writer, subject: "mevcut ilişki veya yeni kişi" }, seed));
});

test("AI 2 single scenario ve positive action kurallarını promptta taşır", () => {
  assert.match(FORTUNE_POLL_WRITER_PROMPT, /scenarioBasis/i);
  assert.match(FORTUNE_POLL_WRITER_PROMPT, /decisionAction/i);
  assert.match(FORTUNE_POLL_WRITER_PROMPT, /negatif\/ters/i);
});

test("AI 3 iki senaryolu AI 2 sorusunu aynı kilitle tek senaryoya yazar", async () => {
  const badWriter = {
    ...writer,
    question: "Mevcut ilişkimde ya da yeni biriyle yakınlaşmaya şans vermeli miyim?",
  };
  const openaiClient = client([{ hasPollSeed: true, candidates: seed.candidates }, badWriter, editorPass()]);
  const result = await runFortunePollPipeline({ fortuneText: "İlişki ve yeni kişi işaretleri var.", falId: "f1", openaiClient });
  assert.deepEqual(result, { hasDilemma: true, question: editorPass().question, option1: "Evet", option2: "Hayır" });
});

test("AI 3 negatif AI 2 sorusunu pozitif doğrudan soruya dönüştürür", async () => {
  const negativeWriter = { ...writer, question: "Bu ilişkiye devam etmemeli miyim?" };
  const finalQuestion = "Yeni biriyle güçlü bir yakınlaşma oluşursa bu ilişkiye ciddi bir şans vermeli miyim?";
  const openaiClient = client([{ hasPollSeed: true, candidates: seed.candidates }, negativeWriter, editorPass(finalQuestion)]);
  assert.equal((await runFortunePollPipeline({ fortuneText: "Yeni bir yakınlaşma var.", falId: "f2", openaiClient })).question, finalQuestion);
});

test("AI 3 ID, subject ve decisionAction değerlerini exact lock ile doğrular", () => {
  for (const invalid of [
    { ...editorPass(), selectedCandidateId: "c1" },
    { ...editorPass(), subject: "mevcut partner" },
    { ...editorPass(), decisionAction: "mevcut ilişkide kalmak" },
  ]) {
    assert.throws(() => parseFortunePollEditor(invalid, writer));
  }
});

test("AI 3 reject sonrası ikinci denemede pass ile Anket oluşturur", async () => {
  const openaiClient = client([{ hasPollSeed: true, candidates: seed.candidates }, writer, editorReject(), editorPass()]);
  const originalError = console.error;
  console.error = () => {};
  try {
    const result = await runFortunePollPipeline({ fortuneText: "Yeni yakınlaşma.", falId: "f3", openaiClient });
    assert.equal(result.hasDilemma, true);
    assert.equal(openaiClient.calls.length, 4);
    assert.match(openaiClient.calls[3].input[1].content[0].text, /INTERNAL RETRY INSTRUCTION/);
  } finally { console.error = originalError; }
});

test("AI 3 iki reject sonrası AI 2 fallback yayınlamaz", async () => {
  const openaiClient = client([{ hasPollSeed: true, candidates: seed.candidates }, writer, editorReject(), editorReject()]);
  const originalError = console.error;
  console.error = () => {};
  try {
    const result = await runFortunePollPipeline({ fortuneText: "Yeni yakınlaşma.", falId: "f4", openaiClient });
    assert.equal(result.hasDilemma, false);
    assert.equal(openaiClient.calls.length, 4);
  } finally { console.error = originalError; }
});

test("AI 3 teknik hata sonrası ikinci denemede pass ile Anket oluşturur", async () => {
  const openaiClient = client([{ hasPollSeed: true, candidates: seed.candidates }, writer, new Error("timeout"), editorPass()]);
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal((await runFortunePollPipeline({ fortuneText: "Yeni yakınlaşma.", falId: "f5", openaiClient })).hasDilemma, true);
    assert.equal(openaiClient.calls.length, 4);
  } finally { console.error = originalError; }
});

test("negative final prompt kuralı ve yakın tarihli kötü çıktı regression fixture'ı korunur", () => {
  const recentBadOutput = "Falım, aşk hayatımda duygusal bağın derinleşebileceğini; mevcut ilişkide ya da yeni biriyle daha ciddi bir yakınlaşmanın gündeme gelebileceğini söylüyor. Böyle bir dönemde belirsizlikleri göze alıp bu yakınlaşmaya şans vermeli miyim, yoksa temkinli kalıp süreci yavaş mı ilerletmeliyim?";
  assert.match(recentBadOutput, /mevcut ilişkide ya da yeni biriyle/i);
  assert.match(recentBadOutput, /yoksa temkinli/i);
  assert.match(FORTUNE_POLL_QUESTION_EDITOR_PROMPT, /reddetmemeli miyim/i);
  assert.match(FORTUNE_POLL_QUESTION_EDITOR_PROMPT, /tek senaryo/i);
});

test("no seed AI 2 ve AI 3 çağırmaz", async () => {
  const openaiClient = client([{ hasPollSeed: false, candidates: [] }]);
  assert.equal((await runFortunePollPipeline({ fortuneText: "Genel enerji.", falId: "f6", openaiClient })).hasDilemma, false);
  assert.equal(openaiClient.calls.length, 1);
});

test("AI 2 geçersiz subject ile AI 3 çağrılmaz", async () => {
  const openaiClient = client([{ hasPollSeed: true, candidates: seed.candidates }, { ...writer, subject: "mevcut partner" }]);
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal((await runFortunePollPipeline({ fortuneText: "Yeni yakınlaşma.", falId: "f7", openaiClient })).hasDilemma, false);
    assert.equal(openaiClient.calls.length, 2);
  } finally { console.error = originalError; }
});

test("yalnız yedi desteklenen servis pipeline kullanır", () => {
  const root = new URL("../services/", import.meta.url);
  for (const file of ["falService.js", "tarotService.js", "melekService.js", "ruyaService.js", "elFalService.js", "ruhEsiService.js", "gizliFalService.js"]) {
    assert.match(fs.readFileSync(new URL(file, root), "utf8"), /runFortunePollPipeline/);
  }
  for (const file of ["niyetService.js", "yediGunlukKehanetService.js"]) {
    const path = new URL(file, root);
    if (fs.existsSync(path)) assert.doesNotMatch(fs.readFileSync(path, "utf8"), /runFortunePollPipeline/);
  }
});
