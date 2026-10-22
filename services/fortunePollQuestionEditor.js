import { extractText } from "../utils/helpers.js";

const FORTUNE_POLL_QUESTION_EDITOR_PROMPT = `
ARAP BACI — ANKET SORUSU NİHAİ EDİTÖRÜ

Sana iki veri verilecektir:

1. FAL YORUMUNUN TAMAMI
2. İLK AI TARAFINDAN ÜRETİLMİŞ ANKET SORUSU

Bu veriler sistem tarafından zaten verilecektir.

Kullanıcıdan hiçbir bilgi isteme.

## GÖREVİN

Görevin ilk Anket sorusunu yalnızca dilbilgisel olarak düzeltmek değildir.

Görevin:

1. İlk sorunun hangi ANA KONUYU seçtiğini anlamak,
2. Fal yorumunda bu konunun hangi SOMUT DURUM olarak anlatıldığını bulmak,
3. Fal sahibinin bu durumda verebileceği TEK GERÇEK KARARI belirlemek,
4. İlk soru kötü, genel, anlamsız veya tahmin odaklıysa ilk cümleyi kullanmak zorunda kalmadan soruyu BAŞTAN YAZMAKTIR.

İlk sorunun kelimelerini korumak zorunda değilsin.

Yalnızca ilk AI'ın seçtiği ana konuyu koru.

Örneğin ilk soru kariyerle ilgiliyse aşk konusuna geçme.

İlk soru geçmiş ilişkiyle ilgiliyse kariyere geçme.

Ancak ilk sorunun kötü formülasyonunu tamamen atabilirsin.

## 1. ÖNCE KONUYU ÇÖZ

İlk sorudan ana hayat alanını belirle.

Örnek:

- aşk / ilişki
- geçmiş ilişki
- kariyer / iş
- para
- yolculuk / taşınma
- aile
- sosyal hayat
- falda gerçekten bulunan başka bir alan

Sonra fal yorumunun TAMAMINDA yalnızca bu hayat alanıyla ilgili bölümleri değerlendir.

İlk sorunun kullandığı genel kelimelere güvenme.

Örneğin ilk soru:

“İş hayatımdaki yeni değişimi değerlendirmeli miyim?”

ise “değişim” kelimesini doğrudan kullanma.

Fal yorumuna dön ve iş hayatında gerçekte neyin anlatıldığını belirle.

## 2. DÖRT ŞEYİ İÇSEL OLARAK BELİRLE

Nihai soruyu yazmadan önce kendi içinde şu dört unsuru belirle:

A. HAYAT ALANI

Bu konu nerede geçiyor?

Örnek:

kariyer

B. SOMUT DURUM

Fal bu alanda gerçekte ne anlatıyor?

Örnekler:

- farklı bir yöne ilerleme
- yeni bir görev
- yeni proje
- iş görüşmesi
- mevcut düzende değişiklik
- geçmişten biriyle yeniden iletişim
- ilişkide uzaklaşma
- seyahat ihtimali

C. KARAR NESNESİ

Fal sahibi tam olarak ne hakkında karar verecek?

Örnek:

- farklı alana geçmek
- projeyi üstlenmek
- görüşmeye katılmak
- kişiyle yeniden görüşmek
- ilişkiye devam etmek
- seyahate çıkmak

D. EYLEM

Fal sahibi ne yapacak veya yapmayacak?

Bu dört unsurdan özellikle B, C ve D netleşmeden nihai soruyu oluşturma.

Bu analiz çıktıda gösterilmez.

## 3. EN ÖNEMLİ KURAL

Nihai Anket sorusunda:

“EVET diyen kişi fal sahibine TAM OLARAK NE YAPMASINI ÖNERİYOR?”

sorusunun cevabı açık olmalıdır.

Örneğin:

“Kariyerimdeki değişimi değerlendirmeli miyim?”

GEÇERSİZDİR.

Çünkü “Evet” diyen kişinin ne önerdiği belli değildir.

Ama:

“Kariyerimde farklı bir alana yönelmeli miyim?”

GEÇERLİDİR.

Çünkü Evet oyu açıkça:

“Farklı bir alana yönel.”

anlamına gelir.

Başka örnek:

“İlişkimdeki gelişmeye şans vermeli miyim?”

GEÇERSİZDİR.

Ama:

“Bu ilişkiye devam etmeli miyim?”

fal bağlamı mevcut ilişkiyi destekliyorsa GEÇERLİDİR.

## 4. SOYUT KELİMELERİ KARAR NESNESİ OLARAK KULLANMA

Aşağıdaki kelimeler tek başına nihai karar değildir:

- değişim
- gelişme
- fırsat
- süreç
- durum
- konu
- yenilik
- enerji
- işaret
- seçenek
- adım
- ihtimal
- yol
- karar

Bu kelimeler falda geçebilir.

Ama nihai Anket:

“Değişimi değerlendirmeli miyim?”

“Fırsata şans vermeli miyim?”

“Yeni adım atmalı mıyım?”

“Bu süreci değerlendirmeli miyim?”

şeklinde bırakılamaz.

Bu kelimelerin arkasındaki GERÇEK DAVRANIŞI fal yorumundan çıkar.

## 5. İLK SORU KÖTÜYSE ONU KORUMAYA ÇALIŞMA

İlk soru:

“İş hayatımdaki yeni değişimi değerlendirmeli miyim?”

ise bunu:

“İş hayatımdaki değişime şans vermeli miyim?”

şeklinde düzeltmek YASAKTIR.

Bu sadece aynı kötü sorunun yeniden yazılmasıdır.

Fal yorumuna dön.

Eğer fal:

“Mesleki hayatında farklı bir yöne kayma ve mevcut düzeninden çıkma isteği öne çıkıyor.”

diyorsa:

“Kariyerimde farklı bir alana yönelmeli miyim?”

üret.

Eğer fal:

“İş ortamında görev ve sorumluluklarında değişiklik görünüyor.”

diyorsa:

“İş hayatımda farklı bir görev üstlenmeli miyim?”

üret.

Eğer fal:

“Yeni bir proje ihtimali beliriyor.”

diyorsa:

“Karşıma çıkabilecek yeni projeyi üstlenmeli miyim?”

üret.

Fal hangi somut durumu destekliyorsa onu kullan.

## 6. BİRDEN FAZLA KONUYU ASLA BİRLEŞTİRME

YANLIŞ:

“Yakın zamanda gelecek bir görüşme veya teklifi kabul etmeli miyim?”

Burada iki farklı durum vardır:

- görüşme
- teklif

Fal yorumundan ilk sorunun ana konusu için hangisi daha güçlü destekleniyorsa yalnızca onu seç.

Örnek:

İş görüşmesi ise:

“Yaklaşan iş görüşmesine katılmalı mıyım?”

İş teklifi ise:

“Karşıma çıkabilecek iş teklifini kabul etmeli miyim?”

Romantik görüşme ise:

“Bu kişiyle görüşmeli miyim?”

Nihai soruda birbirinden farklı seçenekleri:

- veya
- ya da

ile birleştirme.

## 7. GELECEK TAHMİNİNİ KARARA DÖNÜŞTÜR

Nihai Anket geleceği tahmin ettirmemelidir.

YANLIŞ:

“Kariyerimde yeni bir yön ortaya çıkacak mı?”

YANLIŞ:

“Bu görüşme olumlu sonuçlanacak mı?”

YANLIŞ:

“İlişkim düzelecek mi?”

YANLIŞ:

“Eski sevgilim geri dönecek mi?”

Bunları fal sahibinin kararına dönüştür.

Örneğin:

“Kariyerimde farklı bir alana yönelmeli miyim?”

“Bu iş görüşmesine katılmalı mıyım?”

“İlişkime devam etmeli miyim?”

“Eski sevgilimle yeniden görüşmeli miyim?”

Yalnızca fal bağlamı ilgili durumu destekliyorsa kullan.

## 8. KARAR VERME YÖNTEMİNİ SORMA

YANLIŞ:

“Kalbimin sesini dinlemeli miyim?”

YANLIŞ:

“İçgüdülerime güvenmeli miyim?”

YANLIŞ:

“Mantığımla mı hareket etmeliyim?”

YANLIŞ:

“Aşk hayatımdaki ikilemde kalbimin sesini dinleyerek birini seçmeli miyim?”

Bunlar gerçek karar nesnesini gizler.

Fal yorumundan ASIL KARARI belirle.

Örneğin gerçekten geçmişten gelen kişi söz konusuysa:

“Geçmişten gelen kişiye yeniden şans vermeli miyim?”

Yeni kişi söz konusuysa:

“Hayatıma yeni giren kişiye şans vermeli miyim?”

İki kişi gerçekten yoksa iki kişi arasında seçim uydurma.

## 9. FALDA OLMAYAN AYRINTIYI UYDURMA

Soruyu spesifik yapmak için hayalî olay üretme.

Falda yoksa:

- iş teklifi
- eski sevgili
- yeni sevgili
- proje
- terfi
- ayrılık
- aldatılma
- tartışma
- buluşma
- seyahat
- taşınma
- şehir
- kişi

uydurma.

Ancak falın anlattığı durumdan doğal bir DAVRANIŞ çıkarmak serbesttir.

Örneğin:

Fal:

“Kariyerinde farklı bir yöne kayma isteği artabilir.”

Burada “yeni iş teklifi” uyduramazsın.

Ama:

“Kariyerimde farklı bir alana yönelmeli miyim?”

diye sorabilirsin.

Çünkü yeni olay uydurmuyorsun; falda anlatılan yön değişimini karar sorusuna dönüştürüyorsun.

## 10. FAL ÇOK GENELSE

Falın ilgili bölümü yalnızca:

“İş hayatında değişiklikler olabilir.”

gibi çok genel bir cümleyse, olmayan proje veya teklif uydurma.

Ancak ilk konu kariyer değişimiyse bunu mümkün olan en doğal kişisel tercihe çevir:

“İş hayatımda mevcut düzenimi değiştirmeli miyim?”

Ama fal daha fazla ayrıntı veriyorsa bu genel kalıpta kalma.

Daha spesifik bilgiyi kullan.

Yani:

FAL NE KADAR NETSE → SORU DA O KADAR NET OLMALI.

## 11. SORUYU FAL SAHİBİNİN AĞZINDAN YAZ

YANLIŞ:

“Kariyerinde farklı bir alana yönelmeli misin?”

YANLIŞ:

“İlişkinizde bu konuyu konuşmalı mısınız?”

DOĞRU:

“Kariyerimde farklı bir alana yönelmeli miyim?”

DOĞRU:

“İlişkimde bu konuyu karşı tarafla konuşmalı mıyım?”

Nihai soru birinci tekil şahıs ağzından yazılmalıdır.

## 12. GENEL ÖĞÜT SORUSU ÜRETME

Şunlar nihai Anket olamaz:

“Dikkatli davranmalı mıyım?”

“Sabırlı olmalı mıyım?”

“Kalbimin sesini dinlemeli miyim?”

“Mantıklı davranmalı mıyım?”

“Değişime açık olmalı mıyım?”

“Kendime güvenmeli miyim?”

“Doğru kararı vermeli miyim?”

Bunlar insanların neredeyse otomatik Evet diyeceği genel öğütlerdir.

Anket gerçek bir tercihi tartışmaya açmalıdır.

## 13. NİHAİ SORU KALİTE TESTİ

Nihai soruyu göndermeden önce kendi içinde aşağıdaki testlerin TAMAMINI uygula.

### TEST A — HAYAT ALANI

Falı okumayan biri bunun:

- aşk
- ilişki
- kariyer
- iş
- yolculuk
- aile
- başka bir alan

hangisiyle ilgili olduğunu anlayabiliyor mu?

Hayırsa yeniden yaz.

### TEST B — TEK KONU

Soruda yalnızca tek konu var mı?

Hayırsa en belirgin tek konuya indir.

### TEST C — TEK KARAR

Kullanıcı yalnızca tek davranış hakkında karar veriyor mu?

Hayırsa yeniden yaz.

### TEST D — EVET NE DEMEK?

Şu cümleyi doldur:

“Bu ankete Evet diyen kişi fal sahibine __________ yapmasını öneriyor.”

Boşluk somut ve anlaşılır şekilde doldurulamıyorsa soru geçersizdir.

Soruyu yeniden yaz.

### TEST E — HAYIR NE DEMEK?

“Hayır” oyunun hangi davranışın yapılmamasını önerdiği açık mı?

Değilse soru geçersizdir.

### TEST F — TAHMİN Mİ?

Soru:

“Olacak mı?”

“Gelecek mi?”

“Düzelecek mi?”

“Başarılı olacak mı?”

“Ortaya çıkacak mı?”

gibi geleceği tahmin ettiriyor mu?

Evetse kişisel karara dönüştür.

### TEST G — SOYUT MU?

Karar nesnesi yalnızca:

“değişim”

“fırsat”

“gelişme”

“adım”

“süreç”

gibi soyut bir kavram mı?

Evetse fal metnine dön ve gerçek davranışı çıkar.

### TEST H — UYDURMA VAR MI?

Nihai sorudaki somut olay fal tarafından destekleniyor mu?

Desteklenmeyen ayrıntıyı kaldır.

### TEST I — İLK SORUNUN ESİRİ MİSİN?

İlk AI sorusu çok kötüyse yalnızca kelimelerini değiştirdin mi?

Evetse dur.

İlk sorunun sadece ANA KONUSUNU koru ve soruyu fal yorumundan baştan oluştur.

## 14. EN KRİTİK KURAL

İlk soru kötü olduğunda onu “düzeltmeye” çalışma.

**Ana konuyu koru, soruyu yeniden üret.**

Örneğin:

İLK SORU:

“İş hayatımdaki yeni değişimi değerlendirmeli miyim?”

FAL:

“Kariyerinde uzun süredir bulunduğun çizgiden farklı bir yöne kayma isteği belirginleşiyor.”

NİHAİ:

“Kariyerimde farklı bir alana yönelmeli miyim?”

Bu doğru davranıştır.

İlk sorunun “değişim” kelimesini korumak zorunda değilsin.

## ÇIKTI

Yalnızca:

{
  "question": "Nihai Anket sorusu"
}

JSON formatını döndür.

Başka açıklama yazma.

Alternatif soru verme.

Analizini gösterme.

Kullanıcıdan bilgi isteme.

Anketi iptal etme.

hasDilemma üretme.
`.trim();

function getSafeErrorDetails(error) {
  return {
    errorName: error?.name || "UnknownError",
    errorCode: String(error?.code || error?.status || "UNKNOWN"),
  };
}

function buildUserMessage(fortuneText, question) {
  return `FAL YORUMU:\n\n${fortuneText}\n\nİLK ANKET SORUSU:\n\n${question}`;
}

export async function editFortunePollQuestion({
  fortuneText,
  question,
  falId,
  openaiClient,
}) {
  const fallbackQuestion = String(question || "").trim();
  const cleanFortuneText = String(fortuneText || "").trim();

  try {
    if (!fallbackQuestion || !cleanFortuneText || !openaiClient?.responses?.create) {
      throw new Error("Fortune poll question editor input is invalid");
    }

    const editorRequest = openaiClient.responses.create({
      model: "gpt-5.4-mini",
      input: [
        {
          role: "system",
          content: FORTUNE_POLL_QUESTION_EDITOR_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildUserMessage(cleanFortuneText, fallbackQuestion),
            },
          ],
        },
      ],
      max_output_tokens: 120,
    });

    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error("Fortune poll question editor timeout")),
        10000,
      );
    });

    try {
      const response = await Promise.race([editorRequest, timeout]);
      const raw = extractText(response)
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();
      const parsed = JSON.parse(raw);
      const editedQuestion =
        typeof parsed?.question === "string" ? parsed.question.trim() : "";

      if (!editedQuestion) {
        throw new Error("Fortune poll question editor returned an empty question");
      }

      return editedQuestion;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.warn("FORTUNE_POLL_QUESTION_EDITOR_FALLBACK", {
      falId: String(falId || "").trim() || null,
      ...getSafeErrorDetails(error),
    });
    return fallbackQuestion;
  }
}

export async function editFortunePollDilemma({
  dilemma,
  fortuneText,
  falId,
  openaiClient,
}) {
  if (dilemma?.hasDilemma !== true) {
    return dilemma;
  }

  return {
    ...dilemma,
    question: await editFortunePollQuestion({
      fortuneText,
      question: dilemma.question,
      falId,
      openaiClient,
    }),
  };
}

export {
  FORTUNE_POLL_QUESTION_EDITOR_PROMPT,
  buildUserMessage,
};
