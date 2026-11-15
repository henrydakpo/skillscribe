function createGeminiResponseFormatError(message) {
  const error = new Error(message);
  error.code = 'GEMINI_RESPONSE_FORMAT';
  return error;
}

function describeResponseFormat(rawText) {
  const text = rawText.trimStart();
  let kind = 'text';

  if (!text) {
    kind = 'empty';
  } else if (text.startsWith('```')) {
    kind = 'markdown';
  } else if (/^<(?:!doctype\s+html|html\b)/i.test(text)) {
    kind = 'html';
  } else if (text.startsWith('{') || text.startsWith('[')) {
    kind = 'json-like';
  }

  return `response kind: ${kind}, length: ${rawText.length} characters`;
}

function parseGeminiResponse(rawText) {
  let bestCandidate;
  let bestCandidateScore = -1;

  for (let start = 0; start < rawText.length; start += 1) {
    if (rawText[start] !== '{') continue;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let end = start; end < rawText.length; end += 1) {
      const character = rawText[end];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === '\\') {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }

      if (character === '"') {
        inString = true;
      } else if (character === '{') {
        depth += 1;
      } else if (character === '}') {
        depth -= 1;
        if (depth === 0) {
          let parsedCandidate;
          try {
            parsedCandidate = JSON.parse(rawText.slice(start, end + 1));
          } catch {
            break;
          }

          const candidate = normalizeGeminiAnalysis(parsedCandidate);
          const score = ['analogy', 'breakdown_steps', 'quiz'].filter(
            (field) => candidate && candidate[field] !== undefined
          ).length;

          if (score > bestCandidateScore) {
            bestCandidate = candidate;
            bestCandidateScore = score;
          }

          if (score === 3) {
            try {
              return validateGeminiAnalysis(candidate);
            } catch (error) {
              if (error.code !== 'GEMINI_RESPONSE_FORMAT') throw error;
            }
          }
          break;
        }
      }
    }
  }

  if (bestCandidate !== undefined) return bestCandidate;

  throw createGeminiResponseFormatError(
    `Gemini returned analysis data in an unexpected format (${describeResponseFormat(rawText)}).`
  );
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeKnownKeys(value, aliases) {
  if (!isRecord(value)) return value;

  const normalized = { ...value };
  for (const [key, fieldValue] of Object.entries(value)) {
    const compactKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const canonicalKey = aliases[compactKey];
    if (canonicalKey && normalized[canonicalKey] === undefined) {
      normalized[canonicalKey] = fieldValue;
    }
  }

  return normalized;
}

function normalizeGeminiAnalysis(parsedData) {
  let source = parsedData;

  for (let depth = 0; depth < 3 && isRecord(source); depth += 1) {
    const wrapped = ['analysis', 'result', 'data'].find((key) =>
      isRecord(source[key])
    );
    if (!wrapped) break;
    source = source[wrapped];
  }

  const normalized = normalizeKnownKeys(source, {
    analogy: 'analogy',
    analogytext: 'analogy',
    realworldanalogy: 'analogy',
    breakdownsteps: 'breakdown_steps',
    breakdown: 'breakdown_steps',
    steps: 'breakdown_steps',
    stepbystepbreakdown: 'breakdown_steps',
    quiz: 'quiz',
    quizquestions: 'quiz',
    codesnippet: 'code_snippet',
  });

  if (Array.isArray(normalized && normalized.breakdown_steps)) {
    normalized.breakdown_steps = normalized.breakdown_steps.map((step) =>
      normalizeKnownKeys(step, {
        title: 'title',
        step: 'title',
        description: 'description',
        explanation: 'description',
      })
    );
  }

  if (isRecord(normalized && normalized.quiz)) {
    normalized.quiz = normalizeKnownKeys(normalized.quiz, {
      question: 'question',
      options: 'options',
      choices: 'options',
      correctanswer: 'correct_answer',
    });
  }

  return normalized;
}

function describeShape(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array(${value.length})`;
  if (isRecord(value)) return `object(${Object.keys(value).join(', ')})`;
  return typeof value;
}

function validateGeminiAnalysis(parsedData) {
  const invalidFields = [];

  if (!parsedData || typeof parsedData.analogy !== 'string') {
    invalidFields.push('analogy');
  }

  if (
    !Array.isArray(parsedData && parsedData.breakdown_steps) ||
    parsedData.breakdown_steps.length !== 3 ||
    !parsedData.breakdown_steps.every(
      (step) =>
        step &&
        typeof step.title === 'string' &&
        typeof step.description === 'string'
    )
  ) {
    invalidFields.push('breakdown_steps');
  }

  if (
    !parsedData ||
    !parsedData.quiz ||
    typeof parsedData.quiz.question !== 'string' ||
    !Array.isArray(parsedData.quiz.options) ||
    parsedData.quiz.options.length !== 4 ||
    !parsedData.quiz.options.every((option) => typeof option === 'string') ||
    typeof parsedData.quiz.correct_answer !== 'string'
  ) {
    invalidFields.push('quiz');
  }

  if (invalidFields.length > 0) {
    const availableKeys = isRecord(parsedData)
      ? Object.keys(parsedData).join(', ')
      : '(none)';
    const fieldShapes = ['analogy', 'breakdown_steps', 'quiz']
      .map((field) => `${field}=${describeShape(parsedData && parsedData[field])}`)
      .join(', ');
    throw createGeminiResponseFormatError(
      `Gemini returned analysis data in an unexpected format (invalid: ${invalidFields.join(', ')}; keys: ${availableKeys}; shapes: ${fieldShapes}).`
    );
  }

  return parsedData;
}

module.exports = {
  normalizeGeminiAnalysis,
  parseGeminiResponse,
  validateGeminiAnalysis,
};
