// Mermaid diagrams in the live preview. Mermaid is large, so it is only loaded when a document
// actually contains a ```mermaid block.
import DOMPurify from 'dompurify';

let mermaidModule = null;
let renderCounter = 0;
const svgCache = new Map();

const loadMermaid = () => {
  mermaidModule ??= import('mermaid').then((module) => module.default);
  return mermaidModule;
};

const sanitizeSvg = (svg) => DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });

// Renders one diagram (cached per theme and source). Throws on invalid diagram syntax.
const renderSvg = async (mermaid, source, theme) => {
  const key = `${theme}\n${source}`;
  if (!svgCache.has(key)) {
    const id = `mdit-mermaid-${(renderCounter += 1)}`;
    try {
      const { svg } = await mermaid.render(id, source);
      svgCache.set(key, sanitizeSvg(svg));
    } finally {
      // Mermaid leaves its scratch element behind when rendering fails.
      document.getElementById(`d${id}`)?.remove();
    }
  }
  return svgCache.get(key);
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

// Replaces ```mermaid code blocks inside root (the live preview) with their diagrams.
// Blocks that fail to parse stay as code with the error message above them.
// Safe to run again on the same DOM: when Alpine keeps the preview (same HTML, e.g. a theme switch),
// existing diagrams are redrawn from their stored source instead of being skipped.
export const renderMermaidDiagrams = async (root, theme) => {
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
