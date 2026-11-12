require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const port = process.env.PORT || 5000;
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('GEMINI_API_KEY is required to start the SkillScribe backend.');
}

const ai = new GoogleGenAI({ apiKey });

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'active', service: 'SkillScribe Backend API' });
});

app.post('/api/analyze', async (req, res) => {
  const { inputContent } = req.body || {};

  if (typeof inputContent !== 'string' || inputContent.trim() === '') {
    return res.status(400).json({
      error: 'Input content or code snippet is required.',
    });
  }

  const prompt = `
You are an expert interactive micro-mentor and visual explainer for SkillScribe.
Analyze the following text, code, or concept provided by the user and break it down clearly.

User Input:
"""
${inputContent}
"""

Return a valid JSON object with exactly these keys:
- "analogy": A simple, memorable visual or real-world analogy explaining the core concept.
- "breakdown_steps": An array of 3 distinct, concise step objects, each having "title" and "description".
- "quiz": An object containing a "question" string, an "options" array of 4 choices, and the "correct_answer" string.
- "code_snippet": A highlighted code snippet or text summary if applicable, or null.

Return pure JSON without any extra text or conversational filler.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    const rawText = response.text;
    if (typeof rawText !== 'string' || rawText.trim() === '') {
      throw new Error('Gemini returned an empty response.');
    }

    const cleanedText = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    const parsedData = JSON.parse(cleanedText);

    if (
      !parsedData ||
      typeof parsedData.analogy !== 'string' ||
      !Array.isArray(parsedData.breakdown_steps) ||
      parsedData.breakdown_steps.length !== 3 ||
      !parsedData.breakdown_steps.every(
        (step) =>
          step &&
          typeof step.title === 'string' &&
          typeof step.description === 'string'
      ) ||
      !parsedData.quiz ||
      typeof parsedData.quiz.question !== 'string' ||
      !Array.isArray(parsedData.quiz.options) ||
      parsedData.quiz.options.length !== 4 ||
      !parsedData.quiz.options.every((option) => typeof option === 'string') ||
      typeof parsedData.quiz.correct_answer !== 'string'
    ) {
      throw new Error('Gemini returned analysis data in an unexpected format.');
    }

    res.json({
      success: true,
      data: parsedData,
    });
  } catch (error) {
    console.error('Error processing breakdown with Gemini:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process the analysis request. Please verify your API key and input.',
    });
  }
});

app.listen(port, () => {
  console.log(`SkillScribe server running on port ${port}`);
});
