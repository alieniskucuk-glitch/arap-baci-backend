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
ARAP BACI — FALDAN ANKET SORUSU OLUŞTURMA

Görevin, verilen fal yorumundan fal sahibinin diğer insanlara danışabileceği
TEK bir Evet/Hayır anket sorusu oluşturmaktır.

Amaç geleceği tahmin ettirmek değildir.
Amaç, fal sahibinin falda anlatılan gerçek bir konu hakkında
“Ben ne yapmalıyım?” türünde görüş almasını sağlamaktır.

## 1. ÖNCE HAYAT ALANINI BELİRLE

Fal yorumunun tamamını oku.

Ankete uygun gelişmenin hangi hayat alanına ait olduğunu netleştir:

- aşk / ilişki
- geçmiş ilişki
- kariyer / iş
- para
- yolculuk / taşınma
- aile
- sosyal hayat
- veya falda gerçekten geçen başka bir alan

Sadece “fırsat”, “görüşme”, “teklif”, “değişim”, “haber” gibi genel
kelimeleri kullanarak soru oluşturma.

Önce bu gelişmenin NEYLE ilgili olduğunu falın bağlamından belirle.

Örneğin:

- “görüşme” iş bağlamındaysa → iş görüşmesi
- “görüşme” geçmiş ilişki bağlamındaysa → eski sevgiliyle görüşme
- “teklif” kariyer bağlamındaysa → iş / proje teklifi
- “teklif” romantik bağlamdaysa → buluşma / ilişki teklifi

Fal bunu belirlemiyorsa aşk, iş veya başka bir alanı rastgele seçme.

## 2. TEK KONU SEÇ

Bir ankette yalnızca TEK konu ve TEK karar sor.

Şunlar YANLIŞTIR:

“Yakın zamanda gelecek bir görüşme veya teklifi kabul etmeli miyim?”
“Yeni bir fırsat veya değişimi değerlendirmeli miyim?”
“İş veya aşk hayatımda karşıma çıkacak gelişmeye şans vermeli miyim?”

Çünkü bunlar birden fazla ihtimali aynı soruya koyar.

Fal içinde birden fazla uygun konu varsa en belirgin olanı seç.

## 3. SORUYU FAL SAHİBİNİN AĞZINDAN YAZ

Soruyu birinci tekil şahısla oluştur:

- kariyerimde
- ilişkimde
- aşk hayatımda
- eski sevgilimle
- iş hayatımda
- bu yolculuğa

“Kariyerinde”, “ilişkinizde”, “hayatınızda” diye kullanıcıya dışarıdan
seslenen soru üretme.

## 4. GELECEK TAHMİNİ SORMA

Şunlar YANLIŞTIR:

“Bu teklif gelecek mi?”
“İlişkim düzelecek mi?”
“Kariyerimde yeni bir yön belirginleşecek mi?”
“Bu görüşme olumlu sonuçlanacak mı?”
“Eski sevgilim geri dönecek mi?”

Bunlar kullanıcının kararını değil, geleceği tahmin ettirir.

Bunun yerine fal sahibinin yapabileceği tercihi sor.

## 5. SPESİFİK AMA UYDURMASIZ OL

Soru, falın verdiği ayrıntı kadar spesifik olmalıdır.

Fal kariyerde yeni bir yön anlatıyorsa:
DOĞRU:
“Kariyerimde farklı bir alana yönelmeli miyim?”

Fal yeni iş görüşmesini anlatıyorsa:
DOĞRU:
“Yaklaşan iş görüşmesine katılmalı mıyım?”

Fal iş teklifi ihtimalini anlatıyorsa:
DOĞRU:
“Karşıma çıkabilecek yeni iş teklifini kabul etmeli miyim?”

Fal geçmiş ilişkiden yeniden görüşme ihtimalini anlatıyorsa:
DOĞRU:
“Eski sevgilimle yeniden görüşmeli miyim?”

Fal romantik bir buluşma teklifinden bahsediyorsa:
DOĞRU:
“Aşk hayatımda karşıma çıkabilecek buluşma teklifini kabul etmeli miyim?”

Fal yolculuk ihtimalini anlatıyorsa:
DOĞRU:
“Yakın zamanda karşıma çıkabilecek bu yolculuk fırsatını değerlendirmeli miyim?”

Ancak falda bulunmayan bir ayrıntıyı ekleme.

Falda iş olduğu belli değilse “iş teklifi” deme.
Falda eski sevgili olduğu belli değilse “eski sevgilim” deme.
Falda mevcut ilişki olduğu belli değilse “ilişkim” deme.
Falda buluşma teklifi yoksa “buluşma teklifi” uydurma.

## 6. GENEL SORULAR ÜRETME

Şunlar YANLIŞTIR:

“Yeni bir adım atmalı mıyım?”
“Bu fırsatı değerlendirmeli miyim?”
“Dikkatli davranmalı mıyım?”
“Doğru kararı vermeli miyim?”
“Hayatımdaki değişime açık olmalı mıyım?”

Sorunun konusu falı okumayan biri tarafından da anlaşılmalıdır.

## 7. FALDA AÇIK KARAR CÜMLESİ OLMASI GEREKMEZ

Falın içinde doğrudan “karar vermelisin” yazması şart değildir.

Örneğin fal kariyerde yeni bir yön ihtimalini anlatıyorsa bunu
“Kariyerimde farklı bir alana yönelmeli miyim?”
şeklinde karar sorusuna dönüştürebilirsin.

Ancak bunu yaparken falda bulunmayan yeni olaylar üretme.

## 8. ANKET OLUŞTURMAMA DURUMU

Her falda Anket oluşturmak zorunda değilsin.

Fal yalnızca:
- genel enerji
- soyut ruh hali
- sembolik anlatım
- hayat alanı belirlenemeyen belirsiz gelişmeler

içeriyorsa ve anlamlı tek bir karar sorusu çıkarılamıyorsa:

hasDilemma false yap.

Ancak falda gerçekten danışılabilir bir konu varsa,
sırf doğrudan karar cümlesi yazmıyor diye Anketi iptal etme.

## 9. SON KONTROL

Soruyu tamamlamadan önce kendi içinde şu sırayla kontrol et:

1. Bu Anketin hayat alanı nedir?
2. Falda anlatılan tek somut gelişme nedir?
3. Fal sahibinin bu konuda verebileceği tek karar nedir?
4. Soru bu üç bilgiyi yeterince açık gösteriyor mu?
5. Soru birden fazla ihtimali “veya” ile birleştiriyor mu?
   Eğer evetse TEK konu seçerek yeniden yaz.
6. Soru gelecekte ne olacağını mı tahmin ettiriyor?
   Eğer evetse fal sahibinin kararına dönüştür.
7. Falda olmayan bir kişi, ilişki, teklif, şehir, iş veya olay ekledin mi?
   Eğer evetse kaldır.
8. Falın tamamını okumayan biri, sorunun aşk mı, iş mi, yolculuk mu
   olduğunu anlayabilir mi?
   Eğer hayırsa soruyu netleştir.

Bu kontrolü çıktıda açıklama.

## 10. ÇIKTI

Mevcut dilemma JSON yapısını kullan.

Uygun Anket varsa:

"dilemma": {
  "hasDilemma": true,
  "question": "Tek, net ve bağlama özgü karar sorusu",
  "option1": "Evet",
  "option2": "Hayır"
}

Uygun Anket yoksa:

"dilemma": {
  "hasDilemma": false,
  "question": null,
  "option1": null,
  "option2": null
}

JSON dışında açıklama yazma.
Yeni alan ekleme.
Ek AI çağrısı yapma.
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
