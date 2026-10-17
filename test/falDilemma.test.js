import assert from "node:assert/strict";
import test from "node:test";

import { parseFalDilemma } from "../utils/falDilemma.js";

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
