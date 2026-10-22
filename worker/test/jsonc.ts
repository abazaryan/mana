/**
 * JSON with comments and trailing commas (wrangler.jsonc), for tests: strips // and /* *\/
 * comments and commas before } or ] outside strings, then JSON.parse. No dependency.
 */
export function parseJsonc(text: string): unknown {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"') {
      const start = i++;
      while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
      out += text.slice(start, ++i);
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end < 0 ? text.length : end + 2;
    } else if (c === ',' && /^\s*[}\]]/.test(withoutComments(text.slice(i + 1)))) {
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return JSON.parse(out);
}

/** The start of `rest` with leading whitespace and comments skipped (for the trailing-comma test). */
function withoutComments(rest: string): string {
  for (;;) {
    const trimmed = rest.trimStart();
    if (trimmed.startsWith('//')) {
      const end = trimmed.indexOf('\n');
      rest = end < 0 ? '' : trimmed.slice(end + 1);
    } else if (trimmed.startsWith('/*')) {
      const end = trimmed.indexOf('*/');
      rest = end < 0 ? '' : trimmed.slice(end + 2);
    } else {
      return trimmed;
    }
  }
}
