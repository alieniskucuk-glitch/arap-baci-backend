export function emptyFalDilemma() {
  return {
    hasDilemma: false,
    question: null,
    option1: null,
    option2: null,
  };
}

// This text is deliberately shared by existing insight calls.  It does not
// trigger a second AI request and it keeps the public fortune text untouched.
export const FORTUNE_POLL_DILEMMA_INSTRUCTIONS = `
ANKET KONU KURALLARI:
- Yorumda gerçekten geçen ve kullanıcı için ankete uygun somut bir konu varsa
  anket taslağı hazırla. Kullanıcının açıkça kararsız olması zorunlu değildir.
- Uygun konu yoksa hasDilemma false, question/option1/option2 null olsun.
- Soru kısa, Türkçe ve Evet/Hayır ile yanıtlanabilecek bir kullanıcı sorusu olsun.
- Kişisel bilgi veya yorumda geçmeyen ayrıntı uydurma.
- hasDilemma true olduğunda option1 "Evet", option2 "Hayır" olsun.
`.trim();

export const FORTUNE_POLL_DILEMMA_JSON = `
  "dilemma": {
    "hasDilemma": false,
    "question": null,
    "option1": null,
    "option2": null
  }`;

export function parseFalDilemma(value) {
  if (value?.hasDilemma !== true) {
    return emptyFalDilemma();
  }

  const question =
    typeof value.question === "string" ? value.question.trim() : "";
  const option1 =
    typeof value.option1 === "string" ? value.option1.trim() : "";
  const option2 =
    typeof value.option2 === "string" ? value.option2.trim() : "";

  if (!question || !option1 || !option2) {
    return emptyFalDilemma();
  }

  return {
    hasDilemma: true,
    question,
    option1,
    option2,
  };
}
