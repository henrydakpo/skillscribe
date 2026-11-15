const assert = require('node:assert/strict');
const test = require('node:test');
const { parseGeminiResponse } = require('./gemini-response');

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
