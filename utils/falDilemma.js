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
TEK bir kişisel karar sorusu hazırlamaktır.

Anketi okuyan kişiler fal sahibinin geleceğini bilemez.
Onlardan gelecekte ne olacağını tahmin etmelerini isteme.
Onlardan, fal sahibinin bir konuda ne yapabileceğine ilişkin görüş iste.

Temel ayrım:
“Bu olay gerçekleşecek mi?” diye SORMA.
“Bu konuda ben şu davranışı yapmalı mıyım?” anlamında bir soru hazırla.

Bu anlam zorunludur; belirli bir cümle kalıbını kullanmak zorunlu değildir.

1. FALDAKİ KONUYU SEÇ

Fal yorumunun tamamını oku.

Fal sahibinin başka insanlara danışabileceği bir gelişme, ilişki konusu,
fırsat, yolculuk, değişiklik veya belirsizlik varsa en anlamlı olanını seç.

Yalnızca “aşk”, “kariyer” veya “değişim” başlığını seçmekle yetinme.
Falın o konuda ne anlattığını dikkate al.

Falda açıkça “kararsızsın” denmesi veya iki seçeneğin yazılmış olması gerekmez.
Bir gelişmenin yalnızca ihtimal olarak anlatılması da anket hazırlamaya
engel değildir.

2. KONUYU KİŞİSEL KARAR SORUSUNA DÖNÜŞTÜR

Soruyu fal sahibinin ağzından, birinci tekil şahısla yaz.

“Kariyerinde”, “ilişkinizde”, “hayatınızda” diye kullanıcıya seslenme.
Gerektiğinde “kariyerimde”, “ilişkimde”, “ben” ifadelerini kullan.

Soruda kullanıcının neyi yapmayı düşündüğü anlaşılmalıdır:
görüşmek, konuşmak, yeniden denemek, bir projeyi üstlenmek, seyahate çıkmak
gibi konuya uygun bir tercih veya davranış.

Bunlar örnektir; yalnızca bu eylemleri kullanmak zorunda değilsin.

“Adım atmalı mıyım?” diye soruyorsan hangi adım olduğunu açıkça söyle.
“Fırsatı değerlendirmeli miyim?” diye soruyorsan fırsatın neyle ilgili
olduğunu falın verdiği bilgi ölçüsünde belirt.

Soruyu kısa, gündelik ve doğal Türkçeyle yaz.
Tek bir karar sor. Bir sorunun içine birbirinden bağımsız iki karar koyma.
Soru, sabit “Evet” ve “Hayır” seçenekleriyle cevaplanabilsin.

Anket, herkesin kolayca “Evet” diyeceği genel bir öğüt sorusu olmasın.

“Dikkatli olmalı mıyım?”, “Mantıklı karar vermeli miyim?” veya
“Kendim için iyi olanı seçmeli miyim?” gibi sorular üretme.

Genel bir davranışın iyi olup olmadığını değil, falda anlatılan konuda
belirli bir tercihin yapılıp yapılmamasını sor.

Örneğin fal kariyerde farklı bir yöne ilerleme ihtimalini anlatıyorsa:
“Kariyerimde dikkatli karar vermeli miyim?” yerine
“Kariyerimde farklı bir alana yönelmeli miyim?” diye sor.

Soruyu netleştirirken falda olmayan bir meslek, kişi, teklif, şehir veya
olay ekleme. Kaynak yorum ne kadar ayrıntı veriyorsa o ölçüde netleş.

3. FALDAKİ BİLGİ İLE ÖNERİLEN DAVRANIŞI AYIR

Falın anlattığı duruma uygun bir davranışı, kullanıcının değerlendirebileceği
bir ÖNERİ olarak sorabilirsin. Bu davranışın falda kelimesi kelimesine
yazılmış olması gerekmez.

Ancak soruyu oluşturmak için yeni bir olay veya yaşanmış durum uyduramazsın.

Örneğin:
Fal kariyerde yön değişikliğinden söz ediyorsa farklı bir alana yönelmeyi
sorabilirsin. Fakat ortada bir teklif anlatılmıyorsa “Aldığım yeni iş
teklifini kabul etmeli miyim?” diyemezsin.

Fal yalnızca aşk hayatından söz ediyorsa mevcut bir sevgili varsayamazsın.
Geçmişten gelen kişi açıkça eski sevgili olarak anlatılmıyorsa o kişiye
“eski sevgilim” diyemezsin.
İlişkide belirsizlik anlatılması, aldatılma veya güven ihlali yaşandığı
anlamına gelmez.

Olası bir gelişmeyi gerçekleşmiş gibi sunma.
Kişilerin adlarını, iletişim bilgilerini veya özel kimlik bilgilerini
anket sorusuna taşıma.

4. DOĞRU DÖNÜŞÜM ÖRNEKLERİ

ÖRNEK A — KARİYERDE YÖN DEĞİŞİKLİĞİ

Fal bağlamı:
“Kariyerinde farklı bir yöne ilerleme düşüncesi öne çıkıyor.”

YANLIŞ:
“Yakın zamanda kariyerinde yeni bir yön seçme ihtiyacı belirginleşecek mi?”

DOĞRU:
“Kariyerimde farklı bir alana yönelmeli miyim?”

Neden:
İlki gelecekte ne hissedileceğini tahmin ettirir.
İkincisi fal sahibinin değerlendirebileceği bir tercihi sorar.


ÖRNEK B — MEVCUT İLİŞKİDE ŞÜPHE

Fal bağlamı:
“Mevcut ilişkinde bazı konularda şüphelerin var; konuşma konusu öne çıkıyor.”

YANLIŞ:
“İlişkinizdeki şüpheler açık iletişimle aşılacak mı?”

DOĞRU:
“İlişkimle ilgili şüphelerimi partnerimle açıkça konuşmalı mıyım?”

Neden:
İlki konuşmanın sonucunu tahmin ettirir.
İkincisi konuşup konuşmama kararını sorar.


ÖRNEK C — ESKİ SEVGİLİ

Fal bağlamı:
“Eski sevgilinle yeniden görüşme ihtimali beliriyor.”

YANLIŞ:
“Eski sevgilim bana geri dönecek mi?”

DOĞRU:
“Eski sevgilimle yeniden görüşmeli miyim?”


ÖRNEK D — KARİYER PROJESİ

Fal bağlamı:
“Kariyerinde yeni bir projeye katılma fırsatı gündeme gelebilir.”

YANLIŞ:
“Yeni proje kariyerimde başarılı olmamı sağlayacak mı?”

DOĞRU:
“Kariyerimde gündeme gelebilecek yeni projeye katılmalı mıyım?”


ÖRNEK E — YOLCULUK

Fal bağlamı:
“Yakın zamanda bir seyahate çıkma ihtimali görünüyor.”

YANLIŞ:
“Yaklaşan yolculuk hayatıma iyi gelecek mi?”

DOĞRU:
“Yakın zamanda bir seyahate çıkmalı mıyım?”

Bu örnekleri hazır soru listesi gibi kullanma.
Her soruyu verilen falın kendi içeriğinden üret.
Örneklerdeki kişileri ve olayları başka fallara taşıma.

5. NE ZAMAN ANKET OLUŞTURMA?

Her falda anket hazırlamak zorunda değilsin.

Fal yalnızca genel enerji, soyut ruh hali veya herhangi bir kişisel tercihe
bağlanamayan semboller içeriyorsa anket oluşturma.

Buna karşılık, uygun bir gelişme veya belirsizlik varsa sırf falda açık bir
karar cümlesi bulunmadığı için konuyu eleme.

İlk düşündüğün soru bir gelecek tahmini olduysa, aynı konu üzerinden
kullanıcının değerlendirebileceği bir karar sorusuna dönüştür.
Bunu aynı yanıtı hazırlarken yap; ilk sorunun zayıflığı tek başına
anketten vazgeçme nedeni değildir.

6. SON KONTROL

Soruyu tamamlamadan önce şunu değerlendir:

“Bir kişi bu soruya Evet dediğinde fal sahibine hangi davranışı veya
tercihi öneriyor? Hayır dediğinde hangisini önermiyor?”

Cevap açık olmalıdır.

Evet/Hayır yalnızca bir olayın gerçekleşeceğine dair tahmin anlamına
geliyorsa soruyu yeniden yaz.

Ayrıca:
- Soruyu fal sahibi kendi ağzından mı soruyor?
- Başkası falın tamamını okumadan sorunun konusunu anlayabiliyor mu?
- Sorunun dayandığı durum falda var mı?
- Soruyu netleştirmek için olmayan bir kişi veya olay eklenmiş mi?
- Türkçesi doğal mı?

Bu değerlendirmeyi çıktıda açıklama.

7. ÇIKTI SÖZLEŞMESİ

Mevcut analiz yanıtının diğer alanlarını koru.
Anket sonucunu mevcut “dilemma” alanına yaz.
Yeni alan ekleme; JSON dışında açıklama yazma.

Uygun konu varsa:

"dilemma": {
  "hasDilemma": true,
  "question": "Falın içeriğinden hazırladığın kişisel karar sorusu",
  "option1": "Evet",
  "option2": "Hayır"
}

Uygun konu yoksa:

"dilemma": {
  "hasDilemma": false,
  "question": null,
  "option1": null,
  "option2": null
}
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
