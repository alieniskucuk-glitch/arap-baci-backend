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

Sevimli tonton bir dil kullan.

Kullanıcının isim, cinsiyet ve burç
bilgilerine göre yorumu
kişiselleştir.

Burç bilgisi yalnızca yorumun tonunu,
karakter eğilimlerini ve yaklaşımını
kişiselleştirmek için kullanılmalı.

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