import DOMPurify from 'dompurify';
import { marked } from 'marked';

import { countLines } from '../lib/editor';
import { isAbsoluteLocalPath } from '../lib/paths';
import { highlightCode } from './highlight';

marked.setOptions({
  gfm: true,
  breaks: true,
});

// Top-level h1-h3 headings with their 1-based source line, derived from each token's raw text.
export const outlineFromMarkdown = (markdown) => {
  const items = [];
  let line = 1;
  for (const token of marked.lexer(markdown)) {
    if (token.type === 'heading' && token.depth <= 3) {
      items.push({ depth: token.depth, text: token.text.replace(/[*_`]/g, ''), line });
    }
    line += countLines(token.raw) - 1;
  }
  return items;
};

const localImageRoute = '/mdit-local';

// Absolute disk path for a local <img> src, null for remote/data URLs (left untouched),
// or '' for a relative path that cannot be resolved because the document has no folder yet.
// file:// URLs never get here: DOMPurify strips that scheme during sanitizing.
export const localImagePath = (src, baseDir) => {
  if (src.startsWith('//') || (/^[a-z][a-z0-9+.-]*:/i.test(src) && !/^[a-z]:[\\/]/i.test(src))) {
    return null;
  }

  let path = src;
  try {
    path = decodeURI(src);
  } catch {
    // Keep the path as written when it is not valid percent-encoding.
  }

  if (isAbsoluteLocalPath(path)) {
    return path;
  }
  // The backend cleans the joined path, so "./" and "../" segments resolve there.
  return baseDir ? `${baseDir.replace(/[\\/]+$/, '')}/${path}` : '';
};

// Points local images at the backend route that serves them from disk (localimages.go).
export const resolveLocalImages = (root, baseDir) => {
  for (const img of root.querySelectorAll('img[src]')) {
    const path = localImagePath(img.getAttribute('src'), baseDir);
    if (path === null) {
      continue;
    }
    if (path === '') {
      img.title = 'Save the document to show images with relative paths';
      continue;
    }
    img.setAttribute('src', `${localImageRoute}?path=${encodeURIComponent(path)}`);
  }
};

// Adds preview-only chrome to HTML that DOMPurify already sanitized: code block headers and
// local image sources. Only DOM APIs are used on the inert template, so no untrusted markup is introduced.
export const decoratePreview = (sanitizedHtml, baseDir) => {
  const template = document.createElement('template');
  template.innerHTML = sanitizedHtml;
  decorateCodeBlocks(template.content);
  resolveLocalImages(template.content, baseDir);
  return template.innerHTML;
};

// Wraps each code block in a header holding its language label and a copy button.
// The label is drawn by CSS from data-lang, which keeps it out of the text that
// find-in-preview searches and that copying returns.
export const decorateCodeBlocks = (root) => {
  for (const pre of root.querySelectorAll('pre')) {
    const code = pre.querySelector(':scope > code');
    if (!code) {
      continue;
    }

    const languageClass = [...code.classList].find((name) => name.startsWith('language-'));
    const header = document.createElement('div');
    header.className = 'code-block-header';
    if (languageClass) {
      header.dataset.lang = languageClass.slice('language-'.length);
      highlightCode(code, header.dataset.lang);
    }

    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'code-copy';
    copyButton.title = 'Copy code';
    copyButton.setAttribute('aria-label', 'Copy code');
    copyButton.dataset.copyCode = '';
    const icon = document.createElement('i');
    icon.className = 'ri-file-copy-line';
    copyButton.append(icon);
    header.append(copyButton);

    const block = document.createElement('div');
    block.className = 'code-block';
    pre.replaceWith(block);
    block.append(header, pre);
  }
};

// The single place where Markdown becomes HTML: parse with marked, then sanitize with DOMPurify.
export const renderMarkdown = (markdown) => DOMPurify.sanitize(marked.parse(markdown));
