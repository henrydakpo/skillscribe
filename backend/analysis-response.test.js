const assert = require('node:assert/strict');
const test = require('node:test');
const {
  generateValidatedAnalysis,
  normalizeAnalysis,
  parseAnalysisResponse,
  validateAnalysis,
} = require('./analysis-response');

test('parses JSON surrounded by conversational text', () => {
  const expected = { analogy: 'A toolbox', breakdown_steps: [] };

  assert.deepEqual(
    parseAnalysisResponse(
      `Here is the requested analysis:\n${JSON.stringify(expected)}\nHope this helps!`
    ),
    expected
  );
});

test('parses fenced JSON and ignores braces inside JSON strings', () => {
  const expected = { analogy: 'Use { and } carefully', nested: { ok: true } };

  assert.deepEqual(
    parseAnalysisResponse(`\`\`\`json\n${JSON.stringify(expected)}\n\`\`\``),
    expected
  );
});

test('prefers a complete analysis over a nested title/description object', () => {
  const expected = {
    analogy: 'A toolbox',
    breakdown_steps: [
      { step: 'First', explanation: 'One' },
      { step: 'Second', explanation: 'Two' },
      { step: 'Third', explanation: 'Three' },
      { step: 'Fourth', explanation: 'Four' },
    ],
    quiz: [
      {
        question: 'Which tool?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'A is the right choice.',
      },
    ],
  };
  const rawText = `Malformed wrapper: {"step":{"title":"First","description":"One"} trailing text
${JSON.stringify(expected)}`;

  assert.deepEqual(parseAnalysisResponse(rawText), expected);
});

test('rejects text that contains no valid JSON object', () => {
  assert.throws(
    () => parseAnalysisResponse('The result is not available.'),
    /Runware returned analysis data in an unexpected format/
  );
});

test('describes invalid responses without logging their contents', () => {
  const rawText = '<!doctype html><p>private response</p>';

  assert.throws(
    () => parseAnalysisResponse(rawText),
    (error) =>
      error.code === 'ANALYSIS_RESPONSE_FORMAT' &&
      error.message.includes('response kind: html') &&
      error.message.includes(`length: ${rawText.length} characters`) &&
      !error.message.includes('private response')
  );
});

test('validates the analysis shape expected by the frontend', () => {
  const expected = {
    analogy: 'A toolbox',
    breakdown_steps: [
      { step: 'First', explanation: 'One' },
      { step: 'Second', explanation: 'Two' },
      { step: 'Third', explanation: 'Three' },
      { step: 'Fourth', explanation: 'Four' },
    ],
    quiz: [
      {
        question: 'Which tool?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'A is the right choice.',
      },
    ],
  };

  assert.deepEqual(validateAnalysis(expected), expected);
});

test('accepts 2 to 4 breakdown steps and rejects counts outside that range', () => {
  const createAnalysis = (stepCount) => ({
    analogy: 'A toolbox',
    breakdown_steps: Array.from({ length: stepCount }, (_, index) => ({
      step: `Step ${index + 1}`,
      explanation: `Explanation ${index + 1}`,
    })),
    quiz: [
      {
        question: 'Which tool?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'A is the right choice.',
      },
    ],
  });

  [2, 3, 4].forEach((stepCount) => {
    assert.doesNotThrow(() => validateAnalysis(createAnalysis(stepCount)));
  });
  [1, 5].forEach((stepCount) => {
    assert.throws(
      () => validateAnalysis(createAnalysis(stepCount)),
      /invalid: breakdown_steps/
    );
  });
});

test('reports which expected fields have an invalid shape', () => {
  assert.throws(
    () => validateAnalysis({ analogy: 'A toolbox', breakdown_steps: [] }),
    /invalid: breakdown_steps, quiz/
  );
});

test('rejects keys outside the supplied response contract', () => {
  const analysis = {
    analogy: 'A toolbox',
    breakdown_steps: [
      { step: 'First', explanation: 'One' },
      { step: 'Second', explanation: 'Two' },
      { step: 'Third', explanation: 'Three' },
      { step: 'Fourth', explanation: 'Four' },
    ],
    quiz: [
      {
        question: 'Which tool?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'A is the right choice.',
      },
    ],
    extra: 'unexpected',
  };

  assert.throws(() => validateAnalysis(analysis), /invalid: keys/);
});

test('does not turn a title/description object into fabricated quiz data', () => {
  const parsed = parseAnalysisResponse(
    JSON.stringify({ title: 'Overview', description: 'A short explanation.' })
  );

  assert.throws(
    () => validateAnalysis(parsed),
    /invalid: keys, analogy, breakdown_steps, quiz/
  );
});

test('normalizes known aliases and wrappers to the frontend response shape', () => {
  const parsed = {
    result: {
      analogyText: 'A toolbox',
      breakdown: [
        { step: 'First', explanation: 'One' },
        { title: 'Second', description: 'Two' },
        { step: 'Third', explanation: 'Three' },
        { title: 'Fourth', description: 'Four' },
      ],
      quiz: {
        question: 'Which tool?',
        choices: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'A is the right choice.',
      },
    },
  };
  const normalized = normalizeAnalysis(parsed);

  assert.equal(validateAnalysis(normalized), normalized);
  assert.equal(normalized.analogy, 'A toolbox');
  assert.equal(normalized.breakdown_steps[0].step, 'First');
  assert.equal(normalized.quiz[0].correctAnswer, 'A');
});

test('appends a root-level step only when it completes the four-step breakdown', () => {
  const parsed = {
    analogy: 'A toolbox',
    breakdown_steps: [
      { step: 'First', explanation: 'One' },
      { step: 'Second', explanation: 'Two' },
      { step: 'Third', explanation: 'Three' },
    ],
    step: 'Fourth',
    explanation: 'Four',
    quiz: [
      {
        question: 'Which tool?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'A is the right choice.',
      },
    ],
  };
  const normalized = normalizeAnalysis(parsed);

  assert.equal(validateAnalysis(normalized), normalized);
  assert.equal(normalized.breakdown_steps[3].step, 'Fourth');
  assert.equal(Object.hasOwn(normalized, 'step'), false);
});

test('does not invent missing steps or a quiz for a flattened response', () => {
  const normalized = normalizeAnalysis({
    analogy: 'A toolbox',
    step: 'Overview',
    explanation: 'A short description.',
  });

  assert.throws(
    () => validateAnalysis(normalized),
    /invalid: breakdown_steps, quiz/
  );
});

test('retries once after a malformed response and returns the valid retry', async () => {
  const expected = {
    analogy: 'A toolbox',
    breakdown_steps: [
      { step: 'First', explanation: 'One' },
      { step: 'Second', explanation: 'Two' },
    ],
    quiz: [
      {
        question: 'Which tool?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'A is the right choice.',
      },
    ],
  };
  let calls = 0;

  const result = await generateValidatedAnalysis(async () => {
    calls += 1;
    return calls === 1 ? 'not JSON' : JSON.stringify(expected);
  });

  assert.equal(calls, 2);
  assert.deepEqual(result, expected);
});

test('retries a temporary Runware service error once', async () => {
  const expected = {
    analogy: 'A toolbox',
    breakdown_steps: [
      { step: 'First', explanation: 'One' },
      { step: 'Second', explanation: 'Two' },
    ],
    quiz: [
      {
        question: 'Which tool?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'A is the right choice.',
      },
    ],
  };
  const delays = [];
  let calls = 0;

  const result = await generateValidatedAnalysis(
    async () => {
      calls += 1;
      if (calls === 1) {
        const error = new Error('Service unavailable.');
        error.status = 503;
        throw error;
      }
      return JSON.stringify(expected);
    },
    async (delay) => delays.push(delay)
  );

  assert.equal(calls, 2);
  assert.deepEqual(delays, [1000]);
  assert.deepEqual(result, expected);
});

test('retries an Axios-shaped temporary Runware service error once', async () => {
  const expected = {
    analogy: 'A toolbox',
    breakdown_steps: [
      { step: 'First', explanation: 'One' },
      { step: 'Second', explanation: 'Two' },
    ],
    quiz: [
      {
        question: 'Which tool?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'A is the right choice.',
      },
    ],
  };
  let calls = 0;

  const result = await generateValidatedAnalysis(
    async () => {
      calls += 1;
      if (calls === 1) {
        const error = new Error('Service unavailable.');
        error.response = { status: 503 };
        throw error;
      }
      return JSON.stringify(expected);
    },
    async () => {}
  );

  assert.equal(calls, 2);
  assert.deepEqual(result, expected);
});
