import axios from 'axios';

const LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL || 'http://localhost:5001/translate';

export async function translateText(text, source, target) {
  const res = await axios.post(LIBRETRANSLATE_URL, {
    q: text,
    source: source || 'auto',
    target,
    format: "text"
  });
  return res.data.translatedText;
}