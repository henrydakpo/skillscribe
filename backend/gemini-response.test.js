const assert = require('node:assert/strict');
const test = require('node:test');
const {
  normalizeGeminiAnalysis,
  parseGeminiResponse,
  validateGeminiAnalysis,
} = require('./gemini-response');

test('parses JSON surrounded by conversational text', () => {
  const expected = { analogy: 'A toolbox', breakdown_steps: [] };

  assert.deepEqual(
    parseGeminiResponse(
      `Here is the requested analysis:\n${JSON.stringify(expected)}\nHope this helps!`
    ),
    expected
  );
});

test('parses fenced JSON and ignores braces inside JSON strings', () => {
  const expected = { analogy: 'Use { and } carefully', nested: { ok: true } };

  assert.deepEqual(
    parseGeminiResponse(`\`\`\`json\n${JSON.stringify(expected)}\n\`\`\``),
    expected
  );
});

test('prefers a complete analysis over a nested title/description object', () => {
  const expected = {
    analogy: 'A toolbox',
    breakdown_steps: [
      { title: 'First', description: 'One' },
      { title: 'Second', description: 'Two' },
      { title: 'Third', description: 'Three' },
    ],
    quiz: {
      question: 'Which tool?',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'A',
    },
  };
  const rawText = `Malformed wrapper: {"step":{"title":"First","description":"One"} trailing text
${JSON.stringify(expected)}`;

  assert.deepEqual(parseGeminiResponse(rawText), expected);
});

test('rejects text that contains no valid JSON object', () => {
  assert.throws(
    () => parseGeminiResponse('The result is not available.'),
    /Gemini returned analysis data in an unexpected format/
  );
});

test('describes invalid responses without logging their contents', () => {
  const rawText = '<!doctype html><p>private response</p>';

  assert.throws(
    () => parseGeminiResponse(rawText),
    (error) =>
      error.code === 'GEMINI_RESPONSE_FORMAT' &&
      error.message.includes('response kind: html') &&
      error.message.includes(`length: ${rawText.length} characters`) &&
      !error.message.includes('private response')
  );
});

test('validates the analysis shape expected by the frontend', () => {
  const expected = {
    analogy: 'A toolbox',
    breakdown_steps: [
      { title: 'First', description: 'One' },
      { title: 'Second', description: 'Two' },
      { title: 'Third', description: 'Three' },
    ],
    quiz: {
      question: 'Which tool?',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 'A',
    },
  };

  assert.deepEqual(validateGeminiAnalysis(expected), expected);
});

test('reports which expected fields have an invalid shape', () => {
  assert.throws(
    () => validateGeminiAnalysis({ analogy: 'A toolbox', breakdown_steps: [] }),
    /invalid: breakdown_steps, quiz/
  );
});

test('does not turn a title/description object into fabricated quiz data', () => {
  const parsed = parseGeminiResponse(
    JSON.stringify({ title: 'Overview', description: 'A short explanation.' })
  );

  assert.throws(
    () => validateGeminiAnalysis(parsed),
    /invalid: analogy, breakdown_steps, quiz/
  );
});

test('normalizes known aliases and wrappers to the frontend response shape', () => {
  const parsed = {
    result: {
      analogyText: 'A toolbox',
      breakdown: [
        { step: 'First', explanation: 'One' },
        { title: 'Second', description: 'Two' },
        { title: 'Third', description: 'Three' },
      ],
      quiz: {
        question: 'Which tool?',
        choices: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
      },
    },
  };
  const normalized = normalizeGeminiAnalysis(parsed);

  assert.equal(validateGeminiAnalysis(normalized), normalized);
  assert.equal(normalized.analogy, 'A toolbox');
  assert.equal(normalized.breakdown_steps[0].title, 'First');
  assert.equal(normalized.quiz.correct_answer, 'A');
});
