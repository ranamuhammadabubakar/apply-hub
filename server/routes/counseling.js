import express from "express";
import rateLimit from "express-rate-limit";
import { GoogleGenAI } from "@google/genai";
import { requireAuth } from "../middleware/auth.js";
import User from "../models/User.js";

const router = express.Router();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const clean = (v) => v.replace(/["']/g, "").trim();
const MODEL = clean(process.env.GEMINI_MODEL || "gemini-3.5-flash");
const FALLBACK_MODEL = clean(process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite");

// Errors worth retrying: rate limit and temporary server problems
const RETRYABLE = [429, 500, 503];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Visitors without an account: at most 10 questions per 10 minutes from one address
const publicLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "You have asked a lot of questions. Please wait a few minutes, or create a free account." },
});

const SYSTEM_PROMPT = `You are the Apply Hub career counselor for students in Pakistan.
Help students choose a career path and suitable degree programs based on their academic profile, interests and strengths.
Rules:
- Reply in clear, simple English. If the student writes in Roman Urdu, you may reply in simple Roman Urdu.
- Keep answers short (under 200 words) unless the student asks for detail.
- When you suggest careers, give 3 options ranked by fit, each with one line on why it fits and which degree programs lead to it.
- If important profile information is missing, ask one short question at a time.
- Do not invent specific admission deadlines, merit numbers or fees. Tell the student to check the institution page on Apply Hub.
- Stay on education and career topics.
- Use plain text only. Do not use markdown symbols such as ** or #. For lists, use simple numbers like 1. 2. 3.`;

const VISITOR_NOTE = `The visitor is not logged in, so you do not know their marks, field or city.
Give general guidance, ask one short question if needed, and when it helps, mention once that they can
create a free Apply Hub account to get advice based on their own marks.`;

// Turn the student's profile into short readable text for Gemini
function buildProfileText(user) {
  const p = user?.profile;
  if (!p) return "No profile found. Ask the student about their field, marks and interests.";

  const lines = [
    `Name: ${user.name || "Not given"}`,
    `Field of interest: ${p.field || "Not given"}`,
    `Percentage: ${p.percentage ? p.percentage + "%" : "Not given"}`,
    `City: ${p.city || "Not given"}`,
    `Maximum budget (PKR per year): ${p.maxBudget ? p.maxBudget.toLocaleString("en-US") : "Not given"}`,
    `Interests: ${p.interests?.length ? p.interests.join(", ") : "Not given"}`,
  ];
  return lines.join("\n");
}

// Try the main model twice, then the fallback model once
async function askGemini(contents, systemInstruction) {
  const attempts = [MODEL, MODEL, FALLBACK_MODEL];
  let lastError;

  for (let i = 0; i < attempts.length; i++) {
    try {
      const response = await ai.models.generateContent({
        model: attempts[i],
        contents,
        config: { systemInstruction, temperature: 0.7 },
      });
      return response.text?.trim();
    } catch (err) {
      lastError = err;
      console.error(`Gemini attempt ${i + 1} (${attempts[i]}) failed with status ${err.status}`);
      if (!RETRYABLE.includes(err.status)) throw err;
      if (i < attempts.length - 1) await sleep(1000 * (i + 1));
    }
  }
  throw lastError;
}

// Turn the chat history from the browser into Gemini's format
function toContents(messages, maxMessages) {
  if (!Array.isArray(messages)) return null;
  const contents = messages
    .slice(-maxMessages)
    .filter((m) => m && typeof m.text === "string" && m.text.trim())
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.text.slice(0, 2000) }],
    }));
  if (contents.length === 0 || contents[contents.length - 1].role !== "user") return null;
  return contents;
}

// Shared answer logic for students and visitors
async function answer(res, contents, systemInstruction) {
  try {
    const reply = await askGemini(contents, systemInstruction);
    if (!reply) {
      return res.status(502).json({ message: "The counselor could not answer right now. Please try again." });
    }
    return res.json({ reply });
  } catch (err) {
    console.error("Counseling error:", err.status, err.message);
    if (err.status === 429) {
      return res.status(429).json({ message: "Too many requests right now. Please wait a minute and try again." });
    }
    if (err.status === 500 || err.status === 503) {
      return res.status(503).json({ message: "The counselor is busy right now. Please try again in a minute." });
    }
    return res.status(500).json({ message: "Career counseling is not available at this time." });
  }
}

// Logged-in students: answers use their profile
router.post("/", requireAuth, async (req, res) => {
  const contents = toContents(req.body?.messages, 12);
  if (!contents) return res.status(400).json({ message: "Please type a question." });

  try {
    const userId = req.user.id || req.user._id || req.user.userId;
    const user = userId ? await User.findById(userId).select("name profile").lean() : null;
    return answer(res, contents, `${SYSTEM_PROMPT}\n\nStudent profile:\n${buildProfileText(user)}`);
  } catch (err) {
    console.error("Counseling profile error:", err.message);
    return res.status(500).json({ message: "Career counseling is not available at this time." });
  }
});

// Visitors without an account: general answers, rate limited, no profile
router.post("/public", publicLimiter, async (req, res) => {
  const contents = toContents(req.body?.messages, 6);
  if (!contents) return res.status(400).json({ message: "Please type a question." });
  return answer(res, contents, `${SYSTEM_PROMPT}\n\n${VISITOR_NOTE}`);
});

export default router;