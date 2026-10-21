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
- Soru, falda geçen hayat alanını ve o alandaki somut gelişmeyi birlikte
  söylemeli. "Karşıma çıkacak fırsatı değerlendirmeli miyim?" ve "Hayatımda
  yeni bir adım atmalı mıyım?" gibi öznesi belirsiz sorular üretme. Örneğin
  kariyerde yeni proje anlatılıyorsa "Kariyerimde karşıma çıkabilecek yeni
  projeyi değerlendirmeli miyim?"; ilişkide belirsizlik anlatılıyorsa
  "İlişkimdeki belirsizliğe rağmen yeni bir adım atmalı mıyım?" diye sor.
- Yalnızca "Aşk", "Karar" veya "Değişim" gibi tema etiketleri yeterli değildir;
  sorunun dayandığı gelişme yorumun kendisinde açıkça bulunmalıdır.
- Yorumda yalnızca genel enerji, soyut dönüşüm, semboller veya ruh hali varsa
  hasDilemma false, question/option1/option2 null olsun.
- Yorumda geçmeyen olay, kişi veya ilişki uydurma; eski sevgiliden söz
  edilmiyorsa eski sevgili sorusu üretme. Kişisel bilgi kullanma.
- Soruyu yazmadan önce gelişmenin hayat alanını yorumdan belirle ve soruda
  açıkça belirt. Kariyer fırsatı için yalnız "fırsat" deme; "kariyerimdeki yeni
  fırsatlar" de. İlişki gelişmesi için "aşk hayatım" veya "ilişkim" bağlamını;
  yolculuk için "yolculuk fırsatını" kullan. Bağlam belirgin değilse rastgele
  bir hayat alanı seçme.
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

const GENERIC_QUESTION_TERMS = new Set([
  "acaba",
  "adim",
  "at",
  "atmak",
  "atmal",
  "degerlendir",
  "et",
  "firsat",
  "gelisme",
  "hayat",
  "karsi",
  "karsima",
  "kabul",
  "karar",
  "konu",
  "miyim",
  "mi",
  "mu",
  "ne",
  "olacak",
  "olabilir",
  "sec",
  "sey",
  "cik",
  "cikabil",
  "yeni",
]);

const CONTEXT_FAMILIES = [
  ["ask", "duygusal", "iliski", "partner", "romantik", "sevgili"],
  ["calisma", "is", "kariyer", "meslek", "proje"],
  ["seyahat", "tasin", "tasinma", "yolculuk"],
];

function normalizedWords(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .match(/[a-z]+/g) || [];
}

function wordStems(word) {
  const suffixes = [
    "lerimizden", "larimizdan", "lerinizden", "larinizdan",
    "lerimiz", "larimiz", "leriniz", "lariniz", "lerinde", "larinda",
    "lerindeki", "larindaki", "lerinden", "larindan", "lerimize",
    "larimiza", "leriyle", "lariyla", "lerinin", "larinin", "lerimiz",
    "larimiz", "lerinden", "larindan", "ler", "lar", "imiz", "imizde",
    "imizden", "imizle", "imizda", "imizde", "imda", "imde", "imden",
    "imle", "iniz", "inizde", "inizden", "inde", "inda", "indeki",
    "indaki", "imdeki", "imdaki", "acak", "ecek", "mali", "meli", "den",
    "dan", "de", "da", "ye", "ya", "yi", "yu", "i", "u", "um", "im",
    "in",
  ];
  const stems = new Set([word]);
  for (const suffix of suffixes) {
    if (word.length > suffix.length + 2 && word.endsWith(suffix)) {
      stems.add(word.slice(0, -suffix.length));
    }
  }
  return stems;
}

function meaningfulStems(value) {
  const stems = new Set();
  for (const word of normalizedWords(value)) {
    const wordStemSet = wordStems(word);
    if ([...wordStemSet].some((stem) => GENERIC_QUESTION_TERMS.has(stem))) {
      continue;
    }
    for (const stem of wordStemSet) {
      if (stem.length >= 3 && !GENERIC_QUESTION_TERMS.has(stem)) {
        stems.add(stem);
      }
    }
  }
  return stems;
}

function contextStems(value) {
  const stems = new Set();
  for (const word of normalizedWords(value)) {
    for (const stem of wordStems(word)) {
      if (stem.length >= 2) stems.add(stem);
    }
  }
  return stems;
}

function containsContextFamily(value, family) {
  const words = contextStems(value);
  return family.some((term) =>
    [...words].some((word) => word.startsWith(term) || term.startsWith(word)),
  );
}

function hasSharedContext(question, fortuneText) {
  const questionTerms = meaningfulStems(question);
  const fortuneTerms = meaningfulStems(fortuneText);
  if ([...questionTerms].some((term) => fortuneTerms.has(term))) return true;

  return CONTEXT_FAMILIES.some(
    (family) => containsContextFamily(question, family) && containsContextFamily(fortuneText, family),
  );
}

function hasSpecificSubject(question) {
  const terms = meaningfulStems(question);
  if (terms.size === 0) return false;
  return (
    CONTEXT_FAMILIES.some((family) => containsContextFamily(question, family)) ||
    [...terms].some((term) => term.length >= 4)
  );
}

// The model may return syntactically valid JSON with a vague question.  Keep
// that draft private by rejecting it before any route can persist it.  When
// the source fortune is available (coffee fortune), require a shared concrete
// context; other existing services still get the generic-question guard while
// retaining their current result contracts.
export function isSpecificFalDilemmaQuestion(question, fortuneText = "") {
  if (!hasSpecificSubject(question)) return false;
  return !fortuneText || hasSharedContext(question, fortuneText);
}

export function parseFalDilemma(value, { fortuneText = "" } = {}) {
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
    !question ||
    !option1 ||
    !option2 ||
    !isSpecificFalDilemmaQuestion(question, fortuneText)
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
