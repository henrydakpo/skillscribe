require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { GoogleGenAI, Type } = require('@google/genai');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const {
  normalizeGeminiAnalysis,
  parseGeminiResponse,
  validateGeminiAnalysis,
} = require('./gemini-response');

const app = express();
const port = process.env.PORT || 5000;
const apiKey = process.env.GEMINI_API_KEY;
const jwtSecret = process.env.JWT_SECRET;
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (!apiKey) {
  throw new Error('GEMINI_API_KEY is required to start the SkillScribe backend.');
}

const ai = new GoogleGenAI({ apiKey });

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'active', service: 'SkillScribe Backend API' });
});

function getCredentials(req, res, isSignup) {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Email and password are required.' });
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const passwordBytes = Buffer.byteLength(password, 'utf8');
  if (
    normalizedEmail.length === 0 ||
    normalizedEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    res.status(400).json({ error: 'Enter a valid email address.' });
    return null;
  }

  if (passwordBytes === 0 || passwordBytes > 72) {
    res.status(400).json({
      error: 'Password must be between 1 and 72 bytes.',
    });
    return null;
  }

  if (isSignup && (Array.from(password).length < 8 || passwordBytes < 8)) {
    res.status(400).json({
      error: 'Password must be at least 8 characters long.',
    });
    return null;
  }

  return { email: normalizedEmail, password };
}

function authIsConfigured(res) {
  if (!pool || !jwtSecret || Buffer.byteLength(jwtSecret, 'utf8') < 32) {
    res.status(503).json({
      error:
        'Authentication is not configured. Set DATABASE_URL and a JWT_SECRET of at least 32 characters.',
    });
    return false;
  }

  return true;
}

app.post('/api/auth/signup', async (req, res) => {
  const credentials = getCredentials(req, res, true);
  if (!credentials || !authIsConfigured(res)) return;

  try {
    const passwordHash = await bcrypt.hash(credentials.password, 12);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [credentials.email, passwordHash]
    );
    const user = result.rows[0];
    const token = jwt.sign(
      { email: user.email },
      jwtSecret,
      { subject: String(user.id), expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully.',
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email is already registered.' });
    }

    console.error('Signup failed:', error.message);
    res.status(500).json({ error: 'Server error during signup.' });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  const credentials = getCredentials(req, res, false);
  if (!credentials || !authIsConfigured(res)) return;

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [credentials.email]
    );
    const user = result.rows[0];
    if (
      !user ||
      !(await bcrypt.compare(credentials.password, user.password_hash))
    ) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { email: user.email },
      jwtSecret,
      { subject: String(user.id), expiresIn: '7d' }
    );

    res.json({
      message: 'Signed in successfully.',
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    console.error('Signin failed:', error.message);
    res.status(500).json({ error: 'Server error during signin.' });
  }
});

app.post('/api/analyze', async (req, res) => {
  const { concept, targetAudience } = req.body || {};

  if (typeof concept !== 'string' || concept.trim() === '') {
    return res.status(400).json({
      error: 'A concept or code snippet is required.',
    });
  }

  if (typeof targetAudience !== 'string' || targetAudience.trim() === '') {
    return res.status(400).json({
      error: 'A target audience is required.',
    });
  }

  const prompt = `
You are an expert interactive micro-mentor and visual explainer for SkillScribe.
Explain the concept clearly for the specified target audience. Keep the content concise and accurate.

Concept:
"""
${concept.trim()}
"""

Target audience:
"""
${targetAudience.trim()}
"""

Return exactly one JSON object matching the supplied response schema, with no additional keys or surrounding text.
`;

  try {
  let response;
  for (let attempt = 0; ; attempt += 1) {
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: `
You are SkillScribe's technical educator.
Return exactly one JSON object matching the supplied response schema:
- breakdown_steps contains exactly 4 objects with step and explanation strings
- quiz is an array containing exactly 1 quiz object
Never replace the requested analysis with a title/description summary.
          `.trim(),
          maxOutputTokens: 1024,
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              analogy: { type: Type.STRING },
              breakdown_steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    step: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                  },
                  required: ['step', 'explanation'],
                },
                minItems: 4,
                maxItems: 4,
              },
              quiz: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      minItems: 4,
                      maxItems: 4,
                    },
                    correctAnswer: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                  },
                  required: [
                    'question',
                    'options',
                    'correctAnswer',
                    'explanation',
                  ],
                },
                minItems: 1,
                maxItems: 1,
              },
            },
            required: ['analogy', 'breakdown_steps', 'quiz'],
          },
        },
      });
      break;
    } catch (error) {
      if (error.status !== 503 || attempt >= 2) {
        throw error;
      }

      const delay = 1000 * 2 ** attempt;
      console.warn(
        `Gemini is temporarily unavailable; retrying in ${delay}ms.`
      );
      await sleep(delay);
    }
    }

    const rawText = response.text;
    if (typeof rawText !== 'string' || rawText.trim() === '') {
      throw new Error('Gemini returned an empty response.');
    }

    const parsedData = validateGeminiAnalysis(
      normalizeGeminiAnalysis(parseGeminiResponse(rawText))
    );

    res.json({
      success: true,
      data: parsedData,
    });
  } catch (error) {
    if (error.code === 'GEMINI_RESPONSE_FORMAT') {
      console.error('Gemini response validation failed:', error.message);
      return res.status(502).json({
        success: false,
        error: 'Gemini returned an unusable response. Please try again.',
      });
    }

    console.error('Error processing breakdown with Gemini:', error);
    if (error.status === 503) {
      return res.status(503).json({
        success: false,
        error: 'Gemini is temporarily experiencing high demand. Please try again shortly.',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to process the analysis request. Please verify your API key and input.',
    });
  }
});

app.listen(port, () => {
  console.log(`SkillScribe server running on port ${port}`);
});
