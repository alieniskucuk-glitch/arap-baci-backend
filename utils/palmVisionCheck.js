import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function checkPalmReadable(base64Image) {
  const response = await openai.responses.create({
    model: "gpt-4o-mini",
    input: [
      {
        role: "system",
        content: `
Sen bir görüntü analiz sistemisin.

Görevin:
Fotoğrafta avuç içi (palm) olup olmadığını ve çizgilerin okunabilir olup olmadığını kontrol etmek.

Sadece JSON cevap ver.

Format:

{
 "isPalm": true/false,
 "readable": true/false
}

Kurallar:
- Fotoğraf el değilse → isPalm=false
- Avuç içi ama çizgiler seçilmiyorsa → readable=false
- Avuç içi net görünüyorsa → readable=true
`,
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Bu fotoğraf avuç içi mi ve çizgiler okunabilir mi?",
          },
          {
            type: "input_image",
            image_url: `data:image/jpeg;base64,${base64Image}`,
          },
        ],
      },
    ],
    max_output_tokens: 50,
  });

  const text = response.output_text;

  try {
    return JSON.parse(text);
  } catch {
    return { isPalm: false, readable: false };
  }
}