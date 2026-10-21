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
- Fal yorumunda Anket yapılabilecek gerçek bir gelişme veya belirsizlik varsa
  hasDilemma true yap ve yalnızca bir anket taslağı üret. Açık bir ikilem ya da
  kesinleşmiş olay zorunlu değildir; uygun konu olup olmadığına yorumun
  bağlamına göre karar ver.
- İlişki belirsizliği, aşk hayatındaki gelişmeler, kariyer fırsatları, iş
  projeleri, yolculuk ihtimalleri veya geçmiş ilişkiler; yorumda gerçekten yer
  alıyorsa uygun Anket konusu olabilir. Yorumdaki en belirgin tek gelişmeyi
  seç.
- Konuyu soruda mümkün olduğunca açık belirt. Falda gerçekten bulunan gelişmeyi
  esas al; belirsiz fırsat sorularından kaçın. İlişki, kariyer veya yolculuk
  bağlamı açıksa soruda belirt.
- Falda bulunmayan kişi, olay, teklif veya ilişki uydurma. Bağlam belirgin
  değilse rastgele bir hayat alanı seçme.
- Yalnızca genel enerji, soyut dönüşüm, semboller veya ruh hali varsa
  hasDilemma false, question/option1/option2 null olsun.
- Soru kısa, doğal Türkçe ve Evet/Hayır ile yanıtlanabilecek bir kullanıcı
  sorusu olsun. hasDilemma true olduğunda option1 tam olarak "Evet", option2
  tam olarak "Hayır" olsun.
`.trim();

export const FORTUNE_POLL_DILEMMA_JSON = `
  "dilemma": {
    "hasDilemma": false,
    "question": null,
    "option1": null,
    "option2": null
  }`;

// AI decides whether the source fortune contains an eligible topic. The
// backend only checks that a true result is structurally safe to persist; it
// must not replace the model's contextual decision with keyword lists.
export function isSpecificFalDilemmaQuestion(question) {
  return typeof question === "string" && question.trim().length > 0;
}

export function parseFalDilemma(value, { fortuneText: _fortuneText = "" } = {}) {
  if (value?.hasDilemma !== true) {
    return emptyFalDilemma();
  }

  const question =
    typeof value.question === "string" ? value.question.trim() : "";
  const option1 =
    typeof value.option1 === "string" ? value.option1.trim() : "";
  const option2 =
    typeof value.option2 === "string" ? value.option2.trim() : "";

  if (
    !isSpecificFalDilemmaQuestion(question) ||
    option1 !== "Evet" ||
    option2 !== "Hayır"
  ) {
    return emptyFalDilemma();
  }

  return {
    hasDilemma: true,
    question,
    option1,
    option2,
  };
}
