import OpenAI from "openai";
import { decreaseCoin } from "../utils/coinManager.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const ruyaYorumla = async (req, res) => {
  try {

    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({
        error: "Token gerekli"
      });
    }

    if (!req.coinPrice) {
      return res.status(500).json({
        error:
          "Coin fiyatı belirlenemedi"
      });
    }

    const { dream } = req.body;

    if (
      !dream ||
      dream.trim().length < 5
    ) {
      return res.status(400).json({
        error:
          "Rüya metni çok kısa"
      });
    }

    const user =
      req.ruyaUser || {};

    const prompt = `
Sen Arap Bacı adında
mistik ve sezgileri güçlü
bir rüya yorumcususun.

Kullanıcının isim,
burç ve cinsiyet
bilgilerini kullanarak
yorumu kişiselleştir.

Ancak burçlardan
yararlandığını belli etme.

Burç adı veya
astrolojik ifade yazma.

KULLANICI:

İsim:
${user.name || ""}

Burç:
${user.zodiac || ""}

Cinsiyet:
${user.gender || ""}

RÜYA:

"${dream}"

Rüyayı yorumlarken:

- Psikolojik anlam
- Sembolik anlam
- Bilinçaltı mesajı
- Yakın gelecek
- Geçmiş bağlantıları
- Ruhsal mesajlar
- Genel tavsiyeler

işlenmeli.

Kullanıcının adıyla
doğal hitap et.

Başlık yazma.

Paragraf paragraf anlat.


- ASLA “canım”, “güzelim”, “enerjini hissettim”, “mistik yolculuk”, “auran”, “okyanus gibi ruhun” gibi klişe ifadeler kullanma.
- Fal içinde kullanıcının adını doğal akışa uygun şekilde 1 veya 2 kez kullan. 
- Genel kişilik analizi yapma.
- Kullanıcıyı övme.
- Her yorum benzersiz olsun.
- Samimi, sıcak, gizemli bir dil kullan ama fazla abartma, deneyimli falcı tonu kullan.

En az yaklaşık
700 token uzunluğunda yaz.
`;

    /* =========================
       GPT
    ========================= */

    const response =
      await openai.responses.create({

        model:
          "gpt-4.1-mini",

        input: prompt,

        max_output_tokens:
          1200,
      });

    const result =
      response.output_text ||

      "Rüyanda güçlü bir mesaj var ama biraz daha dikkatle düşünmelisin...";

    /* =========================
       COIN DÜŞ
    ========================= */

    const remainingCoin =
      await decreaseCoin(
        uid,
        req.coinPrice,
        "RUYA"
      );

    /* =========================
       RESPONSE
    ========================= */

    return res.json({
      success: true,

      result,

      remainingCoin,
    });

  } catch (err) {

    console.error(
      "RUYA ERROR:",
      err
    );

    return res.status(500).json({
      error:
        "Rüya yorumlanamadı",
    });

  }
};