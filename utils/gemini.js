/**
 * Gemini API utilities
 *
 * Extracted from server.js - JSON parsing, repair, and extraction functions
 * for handling Gemini AI responses.
 */

const { Buffer } = require('buffer');

const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION || 'v1beta';

/**
 * Build Gemini API URL for a given model
 */
function buildGeminiUrl(model, apiKey) {
  return `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${model}:generateContent?key=${apiKey}`;
}

/**
 * Repair malformed JSON strings from Gemini responses
 * Handles unclosed strings, unescaped characters, trailing commas
 */
function repairGeminiJsonString(jsonString) {
  if (typeof jsonString !== 'string') {
    return jsonString;
  }

  let sanitized = '';
  let inString = false;
  let stringStartIndex = null;

  for (let i = 0; i < jsonString.length; i += 1) {
    const char = jsonString[i];

    if (inString) {
      if (char === '"') {
        inString = false;
        stringStartIndex = null;
        sanitized += char;
        continue;
      }

      if (char === '\\') {
        const next = jsonString[i + 1];
        if (next && /["\\/bfnrtu]/.test(next)) {
          sanitized += `\\${next}`;
          i += 1;
          continue;
        }
        sanitized += '\\\\';
        continue;
      }

      if (char === '\n') {
        sanitized += '\\n';
        continue;
      }
      if (char === '\r') {
        sanitized += '\\r';
        continue;
      }
      if (char === '\t') {
        sanitized += '\\t';
        continue;
      }
    } else if (char === '"') {
      inString = true;
      stringStartIndex = sanitized.length;
    }

    sanitized += char;
  }

  // Handle unclosed string
  if (inString) {
    let prevIndex = stringStartIndex !== null ? stringStartIndex - 1 : sanitized.length - 1;
    while (prevIndex >= 0 && /\s/.test(sanitized[prevIndex])) {
      prevIndex -= 1;
    }
    const prevChar = prevIndex >= 0 ? sanitized[prevIndex] : null;

    if (prevChar === '{' || prevChar === ',') {
      sanitized = sanitized.slice(0, stringStartIndex);
    } else {
      let backslashCount = 0;
      for (let i = sanitized.length - 1; i >= 0 && sanitized[i] === '\\'; i -= 1) {
        backslashCount += 1;
      }
      if (backslashCount % 2 === 1) {
        sanitized += '\\';
      }
      sanitized += '"';
    }
  }

  // Handle trailing colon
  if (/:\s*$/.test(sanitized)) {
    sanitized += ' null';
  }

  const balanced = balanceJsonBrackets(sanitized);
  return balanced.replace(/,(\s*[}\]])/g, '$1');
}

/**
 * Balance unclosed JSON brackets
 */
function balanceJsonBrackets(jsonString) {
  if (typeof jsonString !== 'string') {
    return jsonString;
  }

  const stack = [];
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < jsonString.length; i += 1) {
    const char = jsonString[i];

    if (inString) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{' || char === '[') {
      stack.push(char);
    } else if (char === '}' || char === ']') {
      const last = stack[stack.length - 1];
      if ((char === '}' && last === '{') || (char === ']' && last === '[')) {
        stack.pop();
      }
    }
  }

  if (!stack.length) {
    return jsonString;
  }

  let closing = '';
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    closing += stack[i] === '{' ? '}' : ']';
  }

  return `${jsonString}${closing}`;
}

/**
 * Extract balanced JSON object from text starting at given index
 */
function sliceBalancedJson(text, startIndex) {
  if (!text || startIndex < 0 || startIndex >= text.length) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === '\\') {
        escapeNext = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIndex, i + 1);
      }
      if (depth < 0) {
        return null;
      }
    }
  }

  return null;
}

/**
 * Extract text from Gemini response candidate
 */
function extractGeminiText(candidate, logger = console) {
  if (!candidate?.content?.parts) {
    return '';
  }

  const textParts = [];
  candidate.content.parts.forEach((part) => {
    if (typeof part.text === 'string' && part.text.trim().length > 0) {
      textParts.push(part.text.trim());
    } else {
      const inline = part.inlineData || part.inline_data;
      const mimeType = inline?.mimeType || inline?.mime_type || '';
      const data = inline?.data;

      if (typeof data === 'string') {
        const normalizedMime = mimeType.toLowerCase();
        const allowInline =
          normalizedMime.startsWith('application/json') ||
          normalizedMime.startsWith('text/') ||
          normalizedMime.length === 0;

        if (allowInline) {
          const isProbablyBase64 = data.length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(data);
          if (isProbablyBase64) {
            try {
              const decoded = Buffer.from(data, 'base64').toString('utf-8').trim();
              if (decoded.length > 0) {
                textParts.push(decoded);
              }
            } catch (decodeError) {
              logger.warn('Failed to decode inlineData from Gemini response', {
                error: decodeError.message,
              });
            }
          } else if (data.trim().length > 0) {
            textParts.push(data.trim());
          }
        }
      }
    }
  });

  return textParts.join('\n').trim();
}

/**
 * Try to parse JSON with repair
 */
function tryParseJson(payload) {
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(repairGeminiJsonString(payload));
  } catch (error) {
    return null;
  }
}

/**
 * Extract JSON from Gemini text response
 * Handles markdown code blocks and raw JSON
 */
function extractJsonFromGeminiText(text) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return null;
  }

  // Try direct parse first
  const quickParse = tryParseJson(text.trim());
  if (quickParse) {
    return quickParse;
  }

  const tryParse = (candidate) => tryParseJson(candidate?.trim());

  // Try extracting from code blocks
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let blockMatch;
  while ((blockMatch = codeBlockRegex.exec(text)) !== null) {
    const parsed = tryParse(blockMatch[1]);
    if (parsed) {
      return parsed;
    }
  }

  // Try finding balanced JSON objects
  let searchIndex = text.indexOf('{');
  while (searchIndex !== -1) {
    const candidate = sliceBalancedJson(text, searchIndex);
    if (candidate) {
      const parsed = tryParse(candidate);
      if (parsed) {
        return parsed;
      }
    }
    searchIndex = text.indexOf('{', searchIndex + 1);
  }

  return null;
}

/**
 * Extract listing data from Gemini text
 * Alias for extractJsonFromGeminiText
 */
function extractListingFromGeminiText(text) {
  return extractJsonFromGeminiText(text);
}

/**
 * Prepare image for Gemini API
 * Returns { inlineData: { mimeType, data } } or null
 */
function prepareImageForGemini(image) {
  if (!image) return null;

  // If already in correct format
  if (image.inlineData?.data) {
    return image;
  }

  // Handle base64 data URL
  const dataMatch = image.data?.match?.(/^data:([^;]+);base64,(.+)$/);
  if (dataMatch) {
    return {
      inlineData: {
        mimeType: dataMatch[1],
        data: dataMatch[2],
      },
    };
  }

  // Handle raw base64
  if (image.data && !image.data.startsWith('http')) {
    return {
      inlineData: {
        mimeType: image.mimeType || 'image/jpeg',
        data: image.data,
      },
    };
  }

  return null;
}

module.exports = {
  buildGeminiUrl,
  repairGeminiJsonString,
  balanceJsonBrackets,
  sliceBalancedJson,
  extractGeminiText,
  tryParseJson,
  extractJsonFromGeminiText,
  extractListingFromGeminiText,
  prepareImageForGemini,
  GEMINI_API_VERSION,
};
