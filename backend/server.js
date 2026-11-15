require('dotenv').config();

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { generateValidatedAnalysis } = require('./analysis-response');

const app = express();
const port = process.env.PORT || 5000;
const runwareApiKey = process.env.RUNWARE_API_KEY;
const jwtSecret = process.env.JWT_SECRET;
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

if (!runwareApiKey) {
  throw new Error('RUNWARE_API_KEY is required to start the SkillScribe backend.');
}

const runwareClient = new OpenAI({
  apiKey: runwareApiKey,
  baseURL: 'https://api.runware.ai/v1',
  maxRetries: 0,
});
const runwareModel = 'openai:gpt@5.5';

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

Return exactly one JSON object with the required analysis fields, without additional keys or surrounding text.
`;

  try {
    const parsedData = await generateValidatedAnalysis(async () => {
      const response = await runwareClient.chat.completions.create({
        model: runwareModel,
        messages: [
          {
            role: 'system',
            content: `You are SkillScribe's technical educator. Return only a JSON object with exactly three root keys: analogy (string), breakdown_steps (2 to 4 objects with step and explanation strings), and quiz (an array containing exactly one object with question, four options, correctAnswer matching one option, and explanation).`,
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 1024,
      });

      const choice = response.choices && response.choices[0];
      return choice && choice.message ? choice.message.content : null;
    });

    res.json({ success: true, data: parsedData });
  } catch (error) {
    if (error.code === 'ANALYSIS_RESPONSE_FORMAT') {
      console.error('Runware response validation failed:', error.message);
      return res.status(502).json({
        success: false,
        error: 'Runware returned an unusable response. Please try again.',
      });
    }

    const upstreamStatus =
      error.status || (error.response && error.response.status);
    console.error('Runware analysis request failed:', {
      status: upstreamStatus || null,
      code: error.code || 'UNKNOWN',
    });
    if (upstreamStatus === 503) {
      return res.status(503).json({
        success: false,
        error: 'Runware is temporarily unavailable. Please try again shortly.',
      });
    }

    res.status(upstreamStatus ? 502 : 500).json({
      success: false,
      error: 'Failed to process the analysis request. Please try again.',
    });
  }
});

app.listen(port, () => {
  console.log(`SkillScribe server running on port ${port}`);
});
