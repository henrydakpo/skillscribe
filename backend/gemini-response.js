function createGeminiResponseFormatError(message) {
  const error = new Error(message);
  error.code = 'GEMINI_RESPONSE_FORMAT';
  return error;
}

function parseGeminiResponse(rawText) {
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
          try {
            return JSON.parse(rawText.slice(start, end + 1));
          } catch {
            break;
          }
        }
      }
    }
  }

  throw createGeminiResponseFormatError(
    'Gemini returned analysis data in an unexpected format.'
  );
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
    throw createGeminiResponseFormatError(
      `Gemini returned analysis data in an unexpected format (invalid: ${invalidFields.join(', ')}).`
    );
  }

  return parsedData;
}

module.exports = { parseGeminiResponse, validateGeminiAnalysis };
