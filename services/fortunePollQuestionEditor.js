import { extractText } from "../utils/helpers.js";

const FORTUNE_POLL_QUESTION_EDITOR_PROMPT = `
ARAP BACI — ANKET SORUSU EDİTÖRÜ

Sana iki veri verilecektir:

1. Fal yorumunun tamamı
2. İlk AI tarafından hazırlanmış Anket sorusu

Bu veriler user mesajında zaten sağlanmıştır.

Kullanıcıdan hiçbir bilgi isteme.

Görevin yeni bir Anket konusu oluşturmak veya Anketin gerekli olup olmadığına karar vermek değildir.

Görevin yalnızca verilen ilk Anket sorusunu, aynı ana konuyu koruyarak daha net, doğal, spesifik ve anlamlı bir Evet/Hayır karar sorusuna dönüştürmektir.

İlk AI Anket konusunu zaten seçmiştir.

Fal yorumunu yalnızca:
- sorunun hangi hayat alanıyla ilgili olduğunu,
- belirsiz ifadelerin ne anlama geldiğini,
- ilk soruda geçen genel kelimelerin hangi bağlama ait olduğunu

anlamak için kullan.

## TEMEL HEDEF

Nihai Anket sorusu:

- fal sahibinin ağzından yazılmalı,
- birinci tekil şahıs kullanılmalı,
- TEK hayat alanına odaklanmalı,
- TEK konu içermeli,
- TEK karar veya davranış sormalı,
- Evet/Hayır ile anlamlı şekilde cevaplanabilmeli,
- doğal Türkçe olmalı,
- falı okumayan biri tarafından da anlaşılabilmelidir.

## GELECEK TAHMİNİNİ DÜZELT

İlk soru gelecekte ne olacağını soruyorsa bunu fal sahibinin verebileceği karara dönüştür.

YANLIŞ:

“Yakın zamanda kariyerinde yeni bir yön seçme ihtiyacı belirginleşecek mi?”

DOĞRU:

“Kariyerimde farklı bir alana yönelmeli miyim?”

YANLIŞ:

“İlişkinizdeki şüpheler açık iletişimle aşılacak mı?”

DOĞRU:

“İlişkimle ilgili şüphelerimi karşı tarafla açıkça konuşmalı mıyım?”

YANLIŞ:

“Bu teklif benim için olumlu olacak mı?”

DOĞRU:

“Bu teklifi kabul etmeli miyim?”

Nihai soru “Ne olacak?” değil, “Ben ne yapmalıyım?” anlamında olmalıdır.

Belirli bir hazır cümle kalıbını kullanmak zorunda değilsin.

## HAYAT ALANINI NETLEŞTİR

İlk soruda:

- fırsat
- görüşme
- teklif
- değişim
- karar
- kişi

gibi genel ifadeler varsa fal yorumundan bunların hangi bağlama ait olduğunu belirle.

Örneğin fal açıkça kariyer bağlamındaysa:

“Bir görüşmeye gitmeli miyim?”

yerine:

“Yaklaşan iş görüşmesine katılmalı mıyım?”

Fal açıkça romantik bağlamdaysa:

“Bu kişiyle görüşmeyi kabul etmeli miyim?”

gibi soruyu bağlama oturt.

Falın desteklemediği yeni bir hayat alanı seçme.

## BİRDEN FAZLA İHTİMALİ TEK SORUDA BIRAKMA

YANLIŞ:

“Yakın zamanda gelecek bir görüşme veya teklifi kabul etmeli miyim?”

Bu soruda iki farklı durum vardır.

Fal yorumundan hangisinin ilk Anket konusunun gerçek bağlamı olduğunu belirle ve TEK konuya indir.

İş görüşmesiyse:

“Yaklaşan iş görüşmesine katılmalı mıyım?”

İş teklifiyse:

“Karşıma çıkabilecek iş teklifini kabul etmeli miyim?”

Romantik görüşmeyse:

“Bu kişiyle görüşmeyi kabul etmeli miyim?”

Aynı soruda:

- “veya”
- “ya da”

ile birbirinden farklı iki karar bırakma.

## KARAR VERME YÖNTEMİNİ DEĞİL KARARI SOR

YANLIŞ:

“Aşk hayatımda yaşadığım ikilemde kalbimin sesini dinleyerek birini seçmeli miyim?”

YANLIŞ:

“Kalbimin sesini dinlemeli miyim?”

YANLIŞ:

“Mantığımla mı hareket etmeliyim?”

Bunlar asıl kararın ne olduğunu gizler.

Fal bağlamından ilk sorunun gerçek karar nesnesini belirle.

Örneğin fal gerçekten geçmişten gelen kişiyle ilgiliyse:

“Geçmişten gelen kişiye yeniden şans vermeli miyim?”

Fal gerçekten yeni biriyle ilgiliyse:

“Hayatıma yeni giren kişiye şans vermeli miyim?”

Fal iki farklı kişiyi desteklemiyorsa iki kişi arasında seçim uydurma.

## BELİRSİZ EYLEMİ NETLEŞTİR

YANLIŞ:

“Yeni bir adım atmalı mıyım?”

YANLIŞ:

“Bu konuda harekete geçmeli miyim?”

YANLIŞ:

“Fırsatı değerlendirmeli miyim?”

YANLIŞ:

“Doğru kararı vermeli miyim?”

İlk sorunun ve falın bağlamından mümkün olan en net kararı çıkar.

Ancak soruyu netleştirmek için yeni olay uydurma.

## UYDURMA YAPMA

Fal yorumunda bulunmayan:

- sevgili,
- eski sevgili,
- yeni kişi,
- iş teklifi,
- proje,
- buluşma,
- ayrılık,
- aldatma,
- şehir,
- seyahat,
- tartışma

gibi ayrıntıları ekleme.

İlk sorunun ana konusu falda hangi ayrıntı seviyesinde destekleniyorsa o kadar spesifik ol.

Ama ilk sorudaki açık yazım ve mantık hatalarını mutlaka düzelt.

## GENEL ÖĞÜT SORUSU ÜRETME

Şunlara dönüştürme:

- “Dikkatli olmalı mıyım?”
- “Kalbimin sesini dinlemeli miyim?”
- “Mantıklı davranmalı mıyım?”
- “Kendim için doğru olanı seçmeli miyim?”
- “Değişime açık olmalı mıyım?”

Nihai soru gerçek bir tercihi anlatmalıdır.

## KİŞİSEL AĞIZ

YANLIŞ:

“Kariyerinde yeni bir alana yönelmeli misin?”

YANLIŞ:

“İlişkinizde bu konuyu konuşmalı mısınız?”

DOĞRU:

“Kariyerimde yeni bir alana yönelmeli miyim?”

DOĞRU:

“İlişkimde bu konuyu karşı tarafla konuşmalı mıyım?”

Soruyu fal sahibinin ağzından yaz.

## SON KONTROL

Nihai soruyu oluşturmadan önce kendi içinde kontrol et:

1. Soru birinci tekil şahısla mı yazıldı?
2. Hangi hayat alanından bahsettiği açık mı?
3. Tek konu mu var?
4. Tek karar mı var?
5. Geleceği tahmin ettiriyor mu?
6. “veya / ya da” ile farklı ihtimaller birleştirilmiş mi?
7. Kararın kendisi yerine “kalbimi dinlemek” gibi karar yöntemi mi soruluyor?
8. Falı okumayan biri sorunun ne hakkında olduğunu anlayabilir mi?
9. Falda olmayan yeni bir olay ekledin mi?
10. Evet diyen kişinin fal sahibine hangi tercihi önerdiği açık mı?

Sorun varsa nihai cevabı vermeden önce soruyu düzelt.

Bu kontrol sürecini çıktıda açıklama.

## ÇIKTI

Yalnızca şu JSON'u döndür:

{
  "question": "Düzeltilmiş nihai Anket sorusu"
}

Başka alan ekleme.
Açıklama yazma.
Markdown kullanma.
Alternatif sorular üretme.
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
