import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { runFortunePollPipeline } from "../services/fortunePollPipeline.js";

const seed = {
  hasPollSeed: true,
  candidates: [
    { candidateId: "c1", lifeArea: "aşk", topic: "geçmiş bağ", signal: "işaret", decisionPotential: "karar", specificity: "moderate", strength: "high" },
    { candidateId: "c2", lifeArea: "kariyer", topic: "yeni yön", signal: "işaret", decisionPotential: "karar", specificity: "broad", strength: "medium" },
    { candidateId: "c3", lifeArea: "yolculuk", topic: "yol", signal: "işaret", decisionPotential: "karar", specificity: "broad", strength: "medium" },
  ],
};

function client(outputs) {
  const calls = [];
  return {
    calls,
    responses: {
      create: async () => {
        calls.push(true);
        const next = outputs.shift();
        if (next instanceof Error) throw next;
        return { output_text: JSON.stringify(next) };
      },
    },
  };
}

test("no seed AI 2 ve AI 3 çağırmaz", async () => {
  const openaiClient = client([{ hasPollSeed: false, candidates: [] }]);
  const result = await runFortunePollPipeline({ fortuneText: "Genel enerji.", falId: "f1", openaiClient });
  assert.equal(result.hasDilemma, false);
  assert.equal(openaiClient.calls.length, 1);
});

test("tek seed AI 3 nihai sorusunu kullanır", async () => {
  const one = { ...seed, candidates: [seed.candidates[0]] };
  const openaiClient = client([one, { selectedCandidateId: "c1", question: "Taslak?" }, { selectedCandidateId: "c1", question: "Nihai?" }]);
  const result = await runFortunePollPipeline({ fortuneText: "Aşk işareti.", falId: "f2", openaiClient });
  assert.deepEqual(result, { hasDilemma: true, question: "Nihai?", option1: "Evet", option2: "Hayır" });
});

test("AI 2 c2 seçtiğinde AI 3 aynı candidateId ile devam eder", async () => {
  const openaiClient = client([seed, { selectedCandidateId: "c2", question: "Taslak?" }, { selectedCandidateId: "c2", question: "Nihai?" }]);
  const result = await runFortunePollPipeline({ fortuneText: "Kariyer işareti.", falId: "f3", openaiClient });
  assert.equal(result.question, "Nihai?");
});

test("geçersiz AI 2 ID'si Anket oluşturmaz ve AI 3 çağırmaz", async () => {
  const openaiClient = client([seed, { selectedCandidateId: "c9", question: "Geçersiz" }]);
  const result = await runFortunePollPipeline({ fortuneText: "Kariyer işareti.", falId: "f4", openaiClient });
  assert.equal(result.hasDilemma, false);
  assert.equal(openaiClient.calls.length, 2);
});

test("AI 3 mismatch veya hata AI 2 sorusuna fallback eder", async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    for (const editor of [{ selectedCandidateId: "c1", question: "Yanlış" }, new Error("down")]) {
      const openaiClient = client([seed, { selectedCandidateId: "c2", question: "Taslak soru" }, editor]);
      const result = await runFortunePollPipeline({ fortuneText: "Aşk işareti.", falId: "f5", openaiClient });
      assert.equal(result.question, "Taslak soru");
    }
  } finally { console.warn = originalWarn; }
});

test("AI 2 hatası Anket oluşturmaz ve uzun final metni korunur", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const failed = await runFortunePollPipeline({ fortuneText: "Aşk işareti.", falId: "f6", openaiClient: client([seed, new Error("down")]) });
    assert.equal(failed.hasDilemma, false);
  } finally { console.error = originalError; }
  const longQuestion = "Falımda yeni bir fırsat görünüyor. Bu durum hayatımı değiştirebilir. Böyle bir adım atmalı mıyım?";
  const openaiClient = client([{ ...seed, candidates: [seed.candidates[0]] }, { selectedCandidateId: "c1", question: longQuestion }, { selectedCandidateId: "c1", question: longQuestion }]);
  assert.equal((await runFortunePollPipeline({ fortuneText: "Aşk işareti.", falId: "f7", openaiClient })).question, longQuestion);
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
