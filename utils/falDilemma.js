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
ANKET SORUSU OLUŞTURMA TALİMATI:
- Fal yorumunun tamamını oku. Aşk, ilişki, geçmiş, kariyer, para, yolculuk, aile
  veya başka alanlarda yalnızca konuyu değil, o konuda anlatılan gerçek gelişmeyi,
  belirsizliği, ihtimali ya da kişisel durumu da değerlendir.
- Falın gerçek içeriğine göre Anket için en anlamlı ve en belirgin tek konuyu seç.
- Kısa, açık ve doğal Türkçeyle Evet/Hayır sorusu üret. Okuyan, hangi konu hakkında
  oy verdiğini anlamalıdır. Mümkün olduğunda fal sahibinin kararını, tercihini veya
  davranışını sor.
- Genel bir fal cümlesinin sonuna yalnızca "mı?" ekleme. Gelecekteki ihtimaller de
  Anket konusu olabilir; ancak soruyu yalnızca olayın gerçekleşip gerçekleşmeyeceğini
  soran anlamsız bir tahmine dönüştürme.
- Konuyu soruda açıkça belirt; falda gerçekten bulunan gelişmeyi esas al ve soruyu
  gereksiz yere genel bırakma.
- Falda bulunmayan sevgili, iş teklifi, ayrılık, aldatma, tartışma veya başka somut
  olay ekleme. Kesinleşmemiş ihtimalleri gerçekleşmiş gibi sunma; soruyu
  spesifikleştirmek için hayalî ayrıntı uydurma.
- Açık bir ikilem veya kesinleşmiş olay zorunlu değildir. Her fal için Anket üretmek
  zorunlu değildir: yalnızca genel enerji, soyut duygu veya belirsiz sembollerden
  anlamlı bir soru çıkarılamıyorsa hasDilemma false yap.
- Uygun konuları sabit kelime veya eylem listeleriyle eleme.
- Son kontrolde sorunun konusunun açık, falın gerçek içeriğiyle bağlantılı, anlamlı
  bir Evet/Hayır oylamasına uygun ve doğal Türkçe olduğundan emin ol.
- hasDilemma true ise question boş olamaz; option1 tam olarak "Evet" ve option2
  tam olarak "Hayır" olmalıdır. Uygun konu yoksa question, option1 ve option2 null olmalıdır.
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
