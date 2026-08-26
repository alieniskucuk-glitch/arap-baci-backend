import openai from "../config/openai.js";
import {
  extractText,
  imagesToOpenAI
} from "../utils/helpers.js";

/* =========================
   PROMPTS (KORUNDU)
========================= */

export const FULL_PROMPT = `
Sen “Arap Bacı” adında tecrübeli,
mistik ve sevecen bir kahve falcısısın.

Fincandaki imgelere göre
detaylı ve uzun bir fal yaz.


Kullanıcının isim, cinsiyet ve burç
bilgilerine göre yorumu
kişiselleştir.

Burç bilgisi yalnızca yorumun tonunu,
karakter eğilimlerini ve yaklaşımını
kişiselleştirmek için kullanılmalı.

- ASLA “canım”, “güzelim”, “enerjini hissettim”, “mistik yolculuk”, “auran”, “okyanus gibi ruhun” gibi klişe ifadeler kullanma.
- Fal içinde kullanıcının adını doğal akışa uygun şekilde 1 veya 2 kez kullan. 
- İlk paragraf mutlaka fincanın görsel yoğunluğu, dip, kenar, sembol veya akış analiziyle başlasın.
- Genel kişilik analizi yapma.
- Kullanıcıyı övme.
- Her yorum benzersiz olsun.
- Fazla samimi değil, deneyimli falcı tonu kullan.
- “Sana şunu söylüyor”, “burada görünen şey” tarzı doğal dil kullan.
- Kullanıcıyı memnun etmek için yorumu olumluya çevirme; ne görüyorsan onu dengeli ve dürüst yorumla. Olumsuz işaretleri yumuşatma, her falı umut veren bir sonuca bağlama.


Burç adı veya astrolojik referanslar
doğrudan yazılmamalı.


Falı yorumlarken
gördüğün imgelerden
bahset.

En az 900 token uzunluğunda,
detaylı ve dolu bir yorum üret.

Her bölüm için ayrı enerji,
sembol ve yorumlar ekle.

Fal uzun ve doyurucu olmalı.

BAŞLIKLAR:

1. Genel Enerji
2. Simgeler
3. Geçmiş
4. Aşk
5. Para / İş
6. Yakın Gelecek
7. Özet

Ama başlıkları yazmadan
paragraf paragraf anlat.
`;

/* =========================
   TEK SERVICE
========================= */

export async function generateFal(
  files,
  user = {}
) {

  const profileText = `
KULLANICI:

İsim:
${user.name || ""}

Burç:
${user.zodiac || ""}

Cinsiyet:
${user.gender || ""}
`;

  const r =
    await openai.responses.create({

      model: "gpt-4o",

      temperature: 0.85,

      input: [

        {
          role: "system",
          content:
            FULL_PROMPT
        },

        {
          role: "user",

          content: [

            {
              type:
                "input_text",

              text:
`
${profileText}

Detaylı ve uzun
kahve falı yorumla.

Fincandaki şekilleri
yorumla.

İsim, cinsiyet ve burca göre
kişiselleştir.

Burç bilgisi yalnızca yorumun tonunu,
karakter eğilimlerini ve yaklaşımını
kişiselleştirmek için kullanılmalı.

Burç adı veya astrolojik referanslar
doğrudan yazılmamalı.
`
            },

            ...imagesToOpenAI(
              files
            ),

          ],
        },
      ],

      max_output_tokens:
        1500,
    });

  return extractText(r);
}

/* =========================
   KEHANET KASASI
   - Mevcut fal üretimini değiştirmez
   - Ayrı yardımcı çağrıdır
========================= */

export async function generateFalPrediction(
  falText
) {
  const cleanFal =
    String(falText || "").trim();

  if (!cleanFal) {
    return {
      prediction: null,
      checkAfterDays: null,
    };
  }

  const predictionRequest =
    openai.responses.create({
      model: "gpt-4.1-mini",

      input: [
        {
          role: "system",
          content: `
Verilen kahve falı yorumundan
Kehanet Kasası için
tek bir gelecek öngörüsü çıkar.

Kurallar:

- Fal metninde olmayan yeni bir olay uydurma.
- Yalnızca geleceğe yönelik en net ve sonradan kontrol edilebilir öngörüyü seç.
- prediction tek, açık ve kısa bir cümle olsun.
- checkAfterDays tam sayı olsun.
- checkAfterDays 1 ile 30 arasında olmalı.
- Fal metnindeki zaman ifadesi varsa ona göre belirle.
- Açıklama, markdown veya ek metin yazma.

SADECE şu JSON formatında cevap ver:

{
  "prediction": "öngörü",
  "checkAfterDays": 7
}
`,
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                `KAHVE FALI:\n\n${cleanFal}`,
            },
          ],
        },
      ],

      max_output_tokens: 180,
    });

  const timeout = new Promise(
    (_, reject) => {
      setTimeout(
        () => reject(
          new Error(
            "Prediction timeout"
          )
        ),
        10000
      );
    }
  );

  const response =
    await Promise.race([
      predictionRequest,
      timeout,
    ]);

  const raw =
    extractText(response)
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

  const parsed =
    JSON.parse(raw);

  const prediction =
    typeof parsed.prediction === "string"
      ? parsed.prediction.trim()
      : "";

  const checkAfterDays =
    Number.parseInt(
      parsed.checkAfterDays,
      10
    );

  if (
    !prediction ||
    !Number.isInteger(
      checkAfterDays
    ) ||
    checkAfterDays < 1 ||
    checkAfterDays > 30
  ) {
    throw new Error(
      "Geçersiz prediction cevabı"
    );
  }

  return {
    prediction,
    checkAfterDays,
  };
}
