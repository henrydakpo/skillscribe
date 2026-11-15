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

  throw new Error('Gemini returned analysis data in an unexpected format.');
}

module.exports = { parseGeminiResponse };
