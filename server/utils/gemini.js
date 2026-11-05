import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const clean = (v) => v.replace(/["']/g, '').trim();
const MODEL = clean(process.env.GEMINI_MODEL || 'gemini-3.5-flash');
const FALLBACK_MODEL = clean(process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.1-flash-lite');

const RETRYABLE = [429, 500, 503];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Ask Gemini for a JSON answer. Tries the main model twice, then the fallback model once.
export async function generateJson(prompt, systemInstruction) {
  const attempts = [MODEL, MODEL, FALLBACK_MODEL];
  let lastError;

  for (let i = 0; i < attempts.length; i++) {
    try {
      const response = await ai.models.generateContent({
        model: attempts[i],
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { systemInstruction, temperature: 0, responseMimeType: 'application/json' },
      });
      const text = response.text?.trim() || '';
      // Remove ```json fences in case the model adds them
      return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    } catch (err) {
      lastError = err;
      console.error(`Gemini JSON attempt ${i + 1} (${attempts[i]}) failed: ${err.status || ''} ${err.message}`);
      const retryable = RETRYABLE.includes(err.status) || err instanceof SyntaxError;
      if (!retryable) throw err;
      if (i < attempts.length - 1) await sleep(1000 * (i + 1));
    }
  }
  throw lastError;
}