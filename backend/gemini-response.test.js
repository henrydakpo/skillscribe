const assert = require('node:assert/strict');
const test = require('node:test');
const {
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

test('rejects text that contains no valid JSON object', () => {
  assert.throws(
    () => parseGeminiResponse('The result is not available.'),
    /Gemini returned analysis data in an unexpected format/
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
