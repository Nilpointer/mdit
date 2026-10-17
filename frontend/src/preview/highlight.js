// Syntax highlighting for preview code blocks. Only common languages are registered,
// which keeps the bundle small (highlight.js core instead of the full build).
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

const languages = { bash, c, cpp, css, diff, dockerfile, go, java, javascript, json, markdown, python, rust, sql, typescript, xml, yaml };
for (const [name, definition] of Object.entries(languages)) {
  hljs.registerLanguage(name, definition);
}
// Common fence names that the language definitions do not alias themselves.
hljs.registerAliases(['shell', 'console'], { languageName: 'bash' });

// Highlights a <code> element in place when its language is known (aliases such as js, ts, sh,
// yml or html work too). highlight.js escapes the code text; its span markup is sanitized
// once more before insertion so no unsanitized HTML reaches the preview.
export const highlightCode = (code, language) => {
  if (!language || !hljs.getLanguage(language)) {
    return;
  }

  const result = hljs.highlight(code.textContent, { language, ignoreIllegals: true });
  code.innerHTML = DOMPurify.sanitize(result.value);
  code.classList.add('hljs');
};
