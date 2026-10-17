// Mermaid diagrams in the live preview. Mermaid is large, so it is only loaded when a document
// actually contains a ```mermaid block.
import DOMPurify from 'dompurify';

import { createLruCache } from '../lib/cache';

let mermaidModule = null;
let renderCounter = 0;
let lastPass = Promise.resolve();
// theme + source -> { svg, id } or { error }; parse errors are cached too, so an invalid diagram
// is not parsed again on every keystroke elsewhere in the document.
const svgCache = createLruCache(64);

const loadMermaid = () => {
  mermaidModule ??= import('mermaid')
    .then((module) => module.default)
    .catch((error) => {
      // Allow a later render to retry instead of keeping the failed import forever.
      mermaidModule = null;
      throw error;
    });
  return mermaidModule;
};

// The trailing "x" keeps one id from being a prefix of another (render 3 vs. render 30).
const nextId = () => `mdit-mermaid-${(renderCounter += 1)}x`;

const sanitizeSvg = (svg) => DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });

// Renders one diagram (cached per theme and source). Throws on invalid diagram syntax.
const renderSvg = async (mermaid, source, theme) => {
  const key = `${theme}\n${source}`;
  let entry = svgCache.get(key);
  if (!entry) {
    const id = nextId();
    try {
      const { svg } = await mermaid.render(id, source);
      entry = { svg: sanitizeSvg(svg), id };
    } catch (error) {
      entry = { error };
    } finally {
      // Mermaid leaves its scratch element behind when rendering fails.
      document.getElementById(`d${id}`)?.remove();
    }
    svgCache.set(key, entry);
  }
  if (entry.error) {
    throw entry.error;
  }
  // Mermaid scopes its styles and arrow markers to the render id, so every inserted copy gets its own.
  return entry.svg.replaceAll(entry.id, nextId());
};

// Shows the parse error above a block that failed, reusing the message from an earlier pass.
const showError = (block, error) => {
  const previous = block.previousElementSibling;
  const message = previous?.classList.contains('mermaid-error') ? previous : document.createElement('p');
  message.className = 'mermaid-error';
  message.textContent = `Mermaid diagram error: ${error?.message ?? error}`;
  if (message !== previous) {
    block.before(message);
  }
};

const renderPass = async (root, theme) => {
  const blocks = [
    ...root.querySelectorAll('pre > code.language-mermaid'),
    ...root.querySelectorAll(`.mermaid-diagram:not([data-theme="${theme}"])`),
  ];
  if (blocks.length === 0) {
    return;
  }

  const mermaid = await loadMermaid();
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: theme === 'dark' ? 'dark' : 'default',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    // SVG text labels instead of HTML in foreignObject, which the sanitizer would strip.
    htmlLabels: false,
    flowchart: { htmlLabels: false },
  });

  for (const element of blocks) {
    const isDiagram = element.classList.contains('mermaid-diagram');
    const block = isDiagram ? element : element.closest('.code-block') ?? element.closest('pre');
    const source = isDiagram ? element.dataset.source : element.textContent;
    try {
      const svg = await renderSvg(mermaid, source, theme);
      // The preview may have re-rendered while Mermaid was working.
      if (!block.isConnected) {
        continue;
      }
      const diagram = document.createElement('div');
      diagram.className = 'mermaid-diagram';
      diagram.dataset.source = source;
      diagram.dataset.theme = theme;
      diagram.innerHTML = svg;
      if (block.previousElementSibling?.classList.contains('mermaid-error')) {
        block.previousElementSibling.remove();
      }
      block.replaceWith(diagram);
    } catch (error) {
      if (block.isConnected) {
        showError(block, error);
      }
    }
  }
};

// Replaces ```mermaid code blocks inside root (the live preview) with their diagrams.
// Blocks that fail to parse stay as code with the error message above them.
// Safe to run again on the same DOM: when Alpine keeps the preview (same HTML, e.g. a theme switch),
// existing diagrams are redrawn from their stored source instead of being skipped.
// Passes run one after another, because mermaid.initialize sets the theme globally and an
// overlapping pass would render (and cache) diagrams with the other theme.
export const renderMermaidDiagrams = (root, theme) => {
  const pass = lastPass.then(() => renderPass(root, theme));
  lastPass = pass.catch(() => {});
  return pass;
};
