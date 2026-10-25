import express from "express";
import { GoogleGenAI } from "@google/genai";
import { requireAuth } from "../middleware/auth.js";
import User from "../models/User.js"; 

const router = express.Router();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = (process.env.GEMINI_MODEL || "gemini-3.5-flash").replace(/["']/g, "").trim();

const SYSTEM_PROMPT = `You are the Apply Hub career counselor for students in Pakistan.
Help students choose a career path and suitable degree programs based on their academic profile, interests and strengths.
Rules:
- Reply in clear, simple English.
- Keep answers short (under 200 words) unless the student asks for detail.
- When you suggest careers, give 3 options ranked by fit, each with one line on why it fits and which degree programs lead to it.
- If important profile information is missing, ask one short question at a time.
- Do not invent specific admission deadlines, merit numbers or fees. Tell the student to check the institution page on Apply Hub.
- Stay on education and career topics-Use plain text only. Do not use markdown symbols such as ** or #. For lists, use simple numbers like 1. 2. 3..`;

// Remove private fields before sending the profile to Gemini
function buildProfileText(user) {
  if (!user) return "No profile found.";
  const { password, email, phone, role, __v, createdAt, updatedAt, ...rest } = user;
  return JSON.stringify(rest, null, 2);
}

router.post("/", requireAuth, async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "Messages are required." });
    }

    const contents = messages
      .slice(-12)
      .filter((m) => m && typeof m.text === "string" && m.text.trim())
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.text.slice(0, 2000) }],
      }));

    if (contents.length === 0 || contents[contents.length - 1].role !== "user") {
      return res.status(400).json({ message: "The last message must be from the student." });
    }

    const userId = req.user.id || req.user._id || req.user.userId;
    const user = userId ? await User.findById(userId).lean() : null;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: `${SYSTEM_PROMPT}\n\nStudent profile:\n${buildProfileText(user)}`,
        temperature: 0.7,
      },
    });

    const reply = response.text?.trim();
    if (!reply) {
      return res.status(502).json({ message: "The counselor could not answer right now. Please try again." });
    }

    return res.json({ reply });
  } catch (err) {
    console.error("Counseling error:", err);
    return res.status(500).json({ message: "Career counseling is not available at this time." });
  }
});

export default router;