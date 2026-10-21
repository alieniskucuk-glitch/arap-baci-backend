import assert from "node:assert/strict";
import test from "node:test";

import { parseFalDilemma } from "../utils/falDilemma.js";

function draft(question) {
  return {
    hasDilemma: true,
    question,
    option1: "Evet",
    option2: "Hayır",
  };
}

test("belirgin ikilem iki seçenekli oylama taslağına dönüşür", () => {
  assert.deepEqual(
    parseFalDilemma({
      hasDilemma: true,
      question: "Eski ilişkimle yeniden denemeli miyim?",
      option1: "Yeniden dene",
      option2: "Devam etme",
    }),
    {
      hasDilemma: true,
      question: "Eski ilişkimle yeniden denemeli miyim?",
      option1: "Yeniden dene",
      option2: "Devam etme",
    },
  );
});

test("ikilem yoksa veya taslak eksikse soru uydurulmaz", () => {
  assert.deepEqual(parseFalDilemma({ hasDilemma: false }), {
    hasDilemma: false,
    question: null,
    option1: null,
    option2: null,
  });
  assert.deepEqual(
    parseFalDilemma({ hasDilemma: true, question: "Karar?", option1: "Evet" }),
    {
      hasDilemma: false,
      question: null,
      option1: null,
      option2: null,
    },
  );
});

test("somut karar içermeyen genel ilişki sorusu reddedilir", () => {
  const fortuneText =
    "Romantik ilişkilerinde önemli gelişmeler yaşanabilir. Ancak ilişkinin bazen dengesiz olabileceğine dair işaretler var.";

  assert.deepEqual(
    parseFalDilemma(
      draft(
        "Aşk hayatımdaki belirsizliğe rağmen ilişkimi güçlendirmek için adım atmalı mıyım?",
      ),
      { fortuneText },
    ),
    {
      hasDilemma: false,
      question: null,
      option1: null,
      option2: null,
    },
  );
});

test("kaynak falda desteklenen somut kararlar kabul edilir", () => {
  const careerFortune =
    "Kariyerinde yeni bir proje teklifi gündeme gelebilir ve bu projeyi dikkatle değerlendirmen önemli.";
  const relationshipFortune =
    "Romantik ilişkinin dengesiz ilerlediği bir dönemden geçiyorsun; mevcut ilişkiyi sürdürme konusu zihnini meşgul ediyor.";

  assert.equal(
    parseFalDilemma(
      draft("Kariyerimdeki yeni proje teklifini kabul etmeli miyim?"),
      { fortuneText: careerFortune },
    ).hasDilemma,
    true,
  );
  assert.equal(
    parseFalDilemma(
      draft("İlişkimdeki dengesizlik nedeniyle ilişkiyi sürdürmeli miyim?"),
      { fortuneText: relationshipFortune },
    ).hasDilemma,
    true,
  );
});

test("falda bulunmayan iletişim ve güven sorunları reddedilir", () => {
  const fortuneText =
    "Kariyerinde yeni bir proje teklifi gündeme gelebilir ve bu projeyi dikkatle değerlendirmen önemli.";

  for (const question of [
    "İlişkimdeki iletişim kopukluğunu çözmek için konuşmalı mıyım?",
    "İlişkimdeki güven sorununa rağmen ilişkiye devam etmeli miyim?",
  ]) {
    assert.equal(
      parseFalDilemma(draft(question), { fortuneText }).hasDilemma,
      false,
    );
  }
});
