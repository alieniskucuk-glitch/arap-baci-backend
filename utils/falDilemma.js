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
- Yorumda kullanıcının değerlendirebileceği somut bir gelişme veya karar konusu
  gerçekten anlatılıyorsa hasDilemma true yap ve yalnızca bir anket taslağı
  üret. Kullanıcının açıkça "kararsızım" demesi gerekmez.
- İlişkide gelişme, belirsizlik veya dengesizlik; eski sevgiliyle yeniden
  görüşme ihtimali; yolculuk veya taşınma ihtimali; kariyerde yeni fırsat ya da
  proje; iş veya özel hayatta dikkatle değerlendirilmesi gereken somut bir
  gelişme uygun konu olabilir. Bunlar örnektir; yorumdaki en belirgin tek
  gelişmeyi seç.
- Romantik ilişkide önemli gelişmeler ve dengesizlik varsa, belirsizliğe rağmen
  yeni adım atmayı; kariyerde yeni fırsatlar ve dikkatli değerlendirme varsa,
  bu fırsatları değerlendirmeyi soran kısa bir soru üret.
- Yalnızca "Aşk", "Karar" veya "Değişim" gibi tema etiketleri yeterli değildir;
  sorunun dayandığı gelişme yorumun kendisinde açıkça bulunmalıdır.
- Yorumda yalnızca genel enerji, soyut dönüşüm, semboller veya ruh hali varsa
  hasDilemma false, question/option1/option2 null olsun.
- Yorumda geçmeyen olay, kişi veya ilişki uydurma; eski sevgiliden söz
  edilmiyorsa eski sevgili sorusu üretme. Kişisel bilgi kullanma.
- Soru kısa, Türkçe ve Evet/Hayır ile yanıtlanabilecek bir kullanıcı sorusu
  olsun. hasDilemma true olduğunda option1 tam olarak "Evet", option2 tam
  olarak "Hayır" olsun.
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
