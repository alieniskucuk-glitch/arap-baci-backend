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

test("AI ilişki belirsizliği için geçerli soru döndürdüğünde taslak kabul edilir", () => {
  assert.deepEqual(
    parseFalDilemma(draft("Aşk hayatımdaki belirsizlik yakında netleşir mi?"), {
      fortuneText:
        "Aşk hayatında bir süredir belirsizlik yaratan gelişmeler öne çıkıyor.",
    }),
    {
      hasDilemma: true,
      question: "Aşk hayatımdaki belirsizlik yakında netleşir mi?",
      option1: "Evet",
      option2: "Hayır",
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

test("AI kariyer fırsatı için geçerli soru döndürdüğünde taslak kabul edilir", () => {
  const fortuneText =
    "Kariyerinde yeni bir fırsat ve dikkatle ele alman gereken bir proje gündeme gelebilir.";

  assert.deepEqual(
    parseFalDilemma(
      draft("Kariyerimdeki yeni fırsat benim için olumlu olur mu?"),
      { fortuneText },
    ),
    {
      hasDilemma: true,
      question: "Kariyerimdeki yeni fırsat benim için olumlu olur mu?",
      option1: "Evet",
      option2: "Hayır",
    },
  );
});

test("önceden tanımlanmış eylem kökü olmayan soru sırf bu nedenle reddedilmez", () => {
  assert.equal(
    parseFalDilemma(
      draft("Yaklaşan yolculuk hayatıma iyi gelir mi?"),
      { fortuneText: "Yakında bir yolculuk ihtimali öne çıkıyor." },
    ).hasDilemma,
    true,
  );
});

test("boş veya bozuk dilemma alanları reddedilir", () => {
  assert.deepEqual(parseFalDilemma(draft("   ")), {
    hasDilemma: false,
    question: null,
    option1: null,
    option2: null,
  });
  assert.deepEqual(
    parseFalDilemma({
      hasDilemma: true,
      question: "Kariyerimdeki fırsat olumlu olur mu?",
      option1: "Olur",
      option2: "Olmaz",
    }),
    {
      hasDilemma: false,
      question: null,
      option1: null,
      option2: null,
    },
  );
});
