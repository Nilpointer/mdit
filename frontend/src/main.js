import './style.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';

import Alpine from 'alpinejs';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import 'remixicon/fonts/remixicon.css';
import cheatSheetMarkdown from './assets/markdown/cheatsheet.md?raw';
import aboutMarkdown from './assets/markdown/about.md?raw';

import { BrowserOpenURL, ClipboardSetText, EventsOn, Quit } from '../wailsjs/runtime/runtime';

const initialMarkdown = `# mdit Markdown Viewer

Welcome to your Wails markdown editor.

## Features

- Live preview while you type
- Command palette: press \`Ctrl K\`
- Outline of your headings in the sidebar

### Example Code

\`\`\`go
func hello(name string) string {
    return "Hello " + name
}
\`\`\`

> Tip: Click links in preview to open them in your default browser.

[Wails Documentation](https://wails.io/docs/)
`;

marked.setOptions({
  gfm: true,
  breaks: true,
});

const backendApp = () => window.go?.main?.App;

const filenameFromPath = (path) => {
  if (!path) {
    return 'untitled.md';
  }
  const segments = path.split(/[\\/]/);
  return segments[segments.length - 1] || 'untitled.md';
};

const directoryFromPath = (path) => {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return index > 0 ? path.slice(0, index) : '';
};

const utilityDocs = {
  cheatsheet: { title: 'Markdown Cheat Sheet', content: cheatSheetMarkdown, icon: 'ri-book-2-line', closeHref: '#close-cheatsheet' },
  about: { title: 'About mdit', content: aboutMarkdown, icon: 'ri-information-line', closeHref: '#close-about' },
};

const viewModes = [
  { id: 'editor', icon: 'ri-code-s-slash-line', label: 'Editor' },
  { id: 'split', icon: 'ri-layout-column-line', label: 'Split' },
  { id: 'preview', icon: 'ri-eye-line', label: 'Preview' },
];

const prefsKey = 'mdit.ui';

const loadPrefs = () => {
  try {
    return JSON.parse(window.localStorage.getItem(prefsKey)) ?? {};
  } catch {
    return {};
  }
};

const savePrefs = (prefs) => {
  try {
    window.localStorage.setItem(prefsKey, JSON.stringify(prefs));
  } catch {
    // Preferences are a convenience; ignore unavailable storage.
  }
};

const countLines = (text) => {
  let count = 1;
  for (let index = text.indexOf('\n'); index !== -1; index = text.indexOf('\n', index + 1)) {
    count += 1;
  }
  return count;
};

// Top-level h1-h3 headings with their 1-based source line, derived from each token's raw text.
const outlineFromMarkdown = (markdown) => {
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

const isAbsoluteLocalPath = (path) => path.startsWith('/') || path.startsWith('\\\\') || /^[a-z]:[\\/]/i.test(path);

// Absolute disk path for a local <img> src, null for remote/data URLs (left untouched),
// or '' for a relative path that cannot be resolved because the document has no folder yet.
// file:// URLs never get here: DOMPurify strips that scheme during sanitizing.
const localImagePath = (src, baseDir) => {
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
const resolveLocalImages = (root, baseDir) => {
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
const decoratePreview = (sanitizedHtml, baseDir) => {
  const template = document.createElement('template');
  template.innerHTML = sanitizedHtml;
  decorateCodeBlocks(template.content);
  resolveLocalImages(template.content, baseDir);
  return template.innerHTML;
};

// Wraps each code block in a header holding its language label and a copy button.
// The label is drawn by CSS from data-lang, which keeps it out of the text that
// find-in-preview searches and that copying returns.
const decorateCodeBlocks = (root) => {
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

// Pixel offset of a character inside a textarea, measured with a hidden mirror so wrapped lines count.
const measureOffsetTop = (textarea, offset) => {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement('div');
  for (const prop of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'tabSize', 'paddingTop', 'paddingLeft', 'paddingRight']) {
    mirror.style[prop] = style[prop];
  }
  Object.assign(mirror.style, {
    position: 'absolute',
    visibility: 'hidden',
    top: '0',
    left: '-9999px',
    boxSizing: 'border-box',
    width: `${textarea.clientWidth}px`,
    whiteSpace: textarea.getAttribute('wrap') === 'off' ? 'pre' : 'pre-wrap',
    overflowWrap: 'break-word',
  });
  mirror.textContent = textarea.value.slice(0, offset);
  document.body.append(mirror);
  const top = mirror.scrollHeight;
  mirror.remove();
  return top;
};

window.markdownViewer = () => {
  const prefs = loadPrefs();

  return {
    markdown: '',
    renderedHtml: '',
    exportHtml: '',
    outline: [],
    statusMessage: 'Ready',
    view: viewModes.some((mode) => mode.id === prefs.view) ? prefs.view : 'split',
    sidebarOpen: prefs.sidebarOpen ?? window.innerWidth >= 1024,
    theme: prefs.theme === 'light' ? 'light' : 'dark',
    wordWrap: prefs.wordWrap ?? false,
    viewModes,
    tabs: [],
    activeTabId: null,
    nextTabId: 1,
    historyLimit: 200,
    syncOrigin: null,
    syncReleaseTimer: null,
    renderTimer: null,
    cursor: { line: 1, col: 1 },
    paletteOpen: false,
    paletteQuery: '',
    paletteIndex: 0,
    palettePointer: '',
    searchQuery: '',
    searchIndex: -1,
    searchResultsCount: 0,
    isSearching: false,
    toast: '',
    toastTimer: null,
    init() {
      this.applyTheme();
      for (const key of ['view', 'sidebarOpen', 'theme', 'wordWrap']) {
        this.$watch(key, () => this.persistPrefs());
      }

      const defaultTab = this.createTab({
        markdown: initialMarkdown,
        title: 'untitled.md',
        kind: 'file',
        focus: false,
      });
      this.setActiveTab(defaultTab.id);
      this.listenForOsFileOpens();
      this.openStartupFile();
    },
    listenForOsFileOpens() {
      // Must be registered before GetStartupFile: from then on the backend sends OS file opens as events.
      if (!window.runtime) {
        return;
      }

      EventsOn('open-file', (payload) => this.openFilePayload(payload, { closeCleanDefaultTab: true }));
      EventsOn('open-file-error', (message) => this.notify(`Could not open file: ${message}`));
    },
    async openStartupFile() {
      const app = backendApp();
      if (!app?.GetStartupFile) {
        return;
      }

      try {
        const payload = await app.GetStartupFile();
        if (payload) {
          this.openFilePayload(payload, { closeCleanDefaultTab: true });
        }
      } catch (error) {
        this.notify(`Could not open startup file: ${error?.message ?? error}`);
      }
    },
    persistPrefs() {
      savePrefs({ view: this.view, sidebarOpen: this.sidebarOpen, theme: this.theme, wordWrap: this.wordWrap });
    },

    // Tabs

    activeTab() {
      return this.tabs.find((tab) => tab.id === this.activeTabId) ?? null;
    },
    isCleanUntitledTab(tab) {
      return tab?.kind === 'file' && !tab.filePath && tab.title === 'untitled.md' && !tab.isDirty;
    },
    tabById(tabId) {
      return this.tabs.find((tab) => tab.id === tabId) ?? null;
    },
    makeTabTitle(path, fallback = 'untitled.md') {
      return path ? filenameFromPath(path) : fallback;
    },
    createTab({
      markdown = '',
      filePath = '',
      title,
      kind = 'file',
      isDirty = false,
      focus = true,
    }) {
      const tab = {
        id: this.nextTabId,
        title: title ?? this.makeTabTitle(filePath),
        filePath,
        markdown,
        savedMarkdown: isDirty ? null : markdown,
        kind,
        isDirty,
        history: [markdown],
        historyIndex: 0,
      };

      this.nextTabId += 1;
      this.tabs.push(tab);

      if (focus) {
        this.setActiveTab(tab.id);
      }

      return tab;
    },
    setActiveTab(tabId) {
      const tab = this.tabById(tabId);
      if (!tab) {
        return;
      }

      this.activeTabId = tabId;
      this.markdown = tab.markdown;
      this.cursor = { line: 1, col: 1 };
      this.renderCurrentDocument();
      this.$nextTick(() => {
        this.$refs.editor?.scrollTo({ top: 0 });
        this.$refs.previewScroller?.scrollTo({ top: 0 });
      });
    },
    activateFromSidebar(tabId) {
      this.setActiveTab(tabId);
      this.closeSidebarOnNarrowScreens();
    },
    updateDirty(tab) {
      if (tab.kind === 'file') {
        tab.isDirty = tab.markdown !== tab.savedMarkdown;
      }
    },
    newDocument() {
      this.createTab({ markdown: '', title: 'untitled.md', kind: 'file' });
      if (this.view === 'preview') {
        this.view = 'split';
      }
      this.$nextTick(() => this.$refs.editor?.focus());
    },
    closeTab(tabId) {
      const tab = this.tabById(tabId);
      if (!tab) {
        return;
      }

      if (tab.isDirty) {
        const confirmed = window.confirm(`Close ${tab.title}? Unsaved changes will be lost.`);
        if (!confirmed) {
          return;
        }
      }

      this.removeTab(tabId, { createFallback: true, statusMessage: 'Created new empty tab' });
    },
    removeTab(tabId, { createFallback = true, statusMessage = null } = {}) {
      const index = this.tabs.findIndex((entry) => entry.id === tabId);
      if (index < 0) {
        return;
      }

      const wasActive = this.activeTabId === tabId;
      this.tabs.splice(index, 1);

      if (this.tabs.length === 0) {
        this.activeTabId = null;
        this.markdown = '';
        this.renderedHtml = '';
        this.exportHtml = '';
        this.outline = [];
        if (createFallback) {
          this.createTab({ markdown: '', title: 'untitled.md', kind: 'file' });
          if (statusMessage) {
            this.statusMessage = statusMessage;
          }
        }
        return;
      }

      if (wasActive) {
        const fallbackIndex = Math.max(0, index - 1);
        const fallbackTab = this.tabs[fallbackIndex] ?? this.tabs[0];
        this.setActiveTab(fallbackTab.id);
      }
    },
    closeCleanUntitledTab() {
      const defaultTab = this.tabs.find((tab) => this.isCleanUntitledTab(tab));
      if (!defaultTab) {
        return false;
      }

      this.removeTab(defaultTab.id, { createFallback: false });
      return true;
    },
    openFilePayload(payload, { closeCleanDefaultTab = true } = {}) {
      const content = payload.content ?? payload.Content ?? '';
      const path = payload.path ?? payload.Path ?? '';
      const title = payload.title ?? payload.Title ?? this.makeTabTitle(path);

      const existingTab = this.tabs.find((tab) => tab.kind === 'file' && tab.filePath === path);
      if (closeCleanDefaultTab) {
        this.closeCleanUntitledTab();
      }

      if (existingTab) {
        this.setActiveTab(existingTab.id);
        this.statusMessage = `Focused ${existingTab.title}`;
        return;
      }

      this.createTab({
        markdown: content,
        filePath: path,
        title,
        kind: 'file',
        isDirty: false,
        focus: true,
      });
      this.notify(`Opened ${filenameFromPath(path)}`);
    },
    closeAllTabs() {
      const dirtyCount = this.tabs.filter((tab) => tab.isDirty).length;
      if (dirtyCount > 0) {
        const confirmed = window.confirm(`Close all tabs? ${dirtyCount} tab(s) have unsaved changes.`);
        if (!confirmed) {
          return false;
        }
      }

      this.tabs = [];
      this.activeTabId = null;
      this.createTab({ markdown: '', title: 'untitled.md', kind: 'file' });
      this.statusMessage = 'All tabs closed';
      return true;
    },
    activateAdjacentTab(direction) {
      if (this.tabs.length <= 1) {
        return;
      }

      const currentIndex = this.tabs.findIndex((tab) => tab.id === this.activeTabId);
      if (currentIndex < 0) {
        return;
      }

      const nextIndex = (currentIndex + direction + this.tabs.length) % this.tabs.length;
      const nextTab = this.tabs[nextIndex];
      if (!nextTab) {
        return;
      }

      this.setActiveTab(nextTab.id);
    },
    tabIcon(tab) {
      return this.isUtilityTab(tab) ? utilityDocs[tab.kind].icon : 'ri-markdown-line';
    },
    tabTooltip(tab) {
      if (tab.filePath) {
        return tab.filePath;
      }
      return tab.title;
    },
    activeDirectory() {
      return directoryFromPath(this.activeTab()?.filePath ?? '');
    },

    // Utility documents (cheat sheet, about)

    isUtilityTab(tab) {
      return tab?.kind === 'cheatsheet' || tab?.kind === 'about';
    },
    get isUtility() {
      return this.isUtilityTab(this.activeTab());
    },
    openUtilityDocumentAsTab(kind) {
      const { title, content } = utilityDocs[kind];
      const existing = this.tabs.find((tab) => tab.kind === kind);
      if (existing) {
        this.setActiveTab(existing.id);
        this.statusMessage = `${title} tab focused`;
        return;
      }

      this.createTab({ markdown: content, title, kind, isDirty: false, focus: true });
      this.statusMessage = `${title} opened`;
    },
    toggleUtilityDocument(kind) {
      if (this.activeTab()?.kind !== kind) {
        this.openUtilityDocumentAsTab(kind);
        return;
      }

      this.closeTab(this.activeTabId);
      this.statusMessage = `${utilityDocs[kind].title} closed`;
    },
    editUtilityCopy() {
      const source = this.activeTab();
      if (!this.isUtilityTab(source)) {
        return;
      }

      this.createTab({ markdown: source.markdown, title: `${source.kind}-copy.md`, kind: 'file', isDirty: true });
      this.view = 'split';
      this.statusMessage = 'Opened an editable copy';
    },

    // View

    get showEditor() {
      return !this.isUtility && this.view !== 'preview';
    },
    get showPreview() {
      return this.isUtility || this.view !== 'editor';
    },
    setView(mode) {
      this.view = mode;
    },
    cycleView() {
      if (this.isUtility) {
        this.notify('Read-only document: use “Edit a copy” to see its source');
        return;
      }

      const order = viewModes.map((mode) => mode.id);
      this.view = order[(order.indexOf(this.view) + 1) % order.length];
    },
    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen;
    },
    closeSidebarOnNarrowScreens() {
      if (window.innerWidth < 1024) {
        this.sidebarOpen = false;
      }
    },
    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark';
      this.applyTheme();
    },
    applyTheme() {
      document.documentElement.dataset.theme = this.theme;
    },
    toggleWordWrap() {
      this.wordWrap = !this.wordWrap;
      this.statusMessage = this.wordWrap ? 'Word wrap on' : 'Word wrap off';
    },

    // Editing and history

    renderCurrentDocument() {
      this.renderNow();
    },
    scheduleRender() {
      window.clearTimeout(this.renderTimer);
      this.renderTimer = window.setTimeout(() => this.renderNow(), 80);
    },
    renderNow() {
      // exportHtml is the plain sanitized output used for "Copy rendered HTML"; the preview adds code block chrome.
      this.exportHtml = DOMPurify.sanitize(marked.parse(this.markdown));
      this.renderedHtml = decoratePreview(this.exportHtml, this.activeDirectory());
      this.outline = outlineFromMarkdown(this.markdown);
      if (this.isSearching) {
        this.$nextTick(() => this.refreshSearchResults());
      }
    },
    recordHistoryForActive(nextValue) {
      const tab = this.activeTab();
      if (!tab) {
        return;
      }
      if (nextValue === tab.history[tab.historyIndex]) {
        tab.markdown = nextValue;
        this.updateDirty(tab);
        return;
      }

      tab.history = tab.history.slice(0, tab.historyIndex + 1);
      tab.history.push(nextValue);
      if (tab.history.length > this.historyLimit) {
        const overflow = tab.history.length - this.historyLimit;
        tab.history.splice(0, overflow);
      }
      tab.historyIndex = tab.history.length - 1;
      tab.markdown = nextValue;
      this.updateDirty(tab);
    },
    applyMarkdownToActive(nextValue) {
      const tab = this.activeTab();
      if (!tab) {
        return;
      }

      this.markdown = nextValue;
      this.recordHistoryForActive(nextValue);
      this.renderCurrentDocument();
    },
    undo() {
      const tab = this.activeTab();
      if (!tab || tab.historyIndex === 0) {
        this.statusMessage = 'Nothing to undo';
        return;
      }

      tab.historyIndex -= 1;
      tab.markdown = tab.history[tab.historyIndex] ?? '';
      this.markdown = tab.markdown;
      this.updateDirty(tab);
      this.renderCurrentDocument();
      this.statusMessage = 'Undo';
    },
    redo() {
      const tab = this.activeTab();
      if (!tab || tab.historyIndex >= tab.history.length - 1) {
        this.statusMessage = 'Nothing to redo';
        return;
      }

      tab.historyIndex += 1;
      tab.markdown = tab.history[tab.historyIndex] ?? '';
      this.markdown = tab.markdown;
      this.updateDirty(tab);
      this.renderCurrentDocument();
      this.statusMessage = 'Redo';
    },
    handleEditorInput(event) {
      const tab = this.activeTab();
      if (!tab || this.isUtilityTab(tab)) {
        return;
      }

      this.markdown = event.target.value;
      this.recordHistoryForActive(this.markdown);
      this.updateCursor(event);
      this.scheduleRender();
    },
    clearDocument() {
      const tab = this.activeTab();
      if (!tab || tab.kind !== 'file') {
        this.statusMessage = 'Clear is only available for file tabs';
        return;
      }

      const confirmed = window.confirm('Clear the current document? This can be undone with Undo.');
      if (!confirmed) {
        this.statusMessage = 'Clear canceled';
        return;
      }

      this.applyMarkdownToActive('');
      this.statusMessage = 'Cleared document';
    },
    wrapSelection(before, after = before, placeholder = 'text') {
      const editor = this.$refs.editor;
      if (!editor || this.isUtility) {
        return;
      }

      const { selectionStart: start, selectionEnd: end, value } = editor;
      const selected = value.slice(start, end) || placeholder;
      this.applyMarkdownToActive(value.slice(0, start) + before + selected + after + value.slice(end));
      this.$nextTick(() => {
        editor.focus();
        editor.setSelectionRange(start + before.length, start + before.length + selected.length);
      });
    },
    prefixLine(prefix) {
      const editor = this.$refs.editor;
      if (!editor || this.isUtility) {
        return;
      }

      const { selectionStart: start, value } = editor;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      this.applyMarkdownToActive(value.slice(0, lineStart) + prefix + value.slice(lineStart));
      this.$nextTick(() => {
        editor.focus();
        editor.setSelectionRange(start + prefix.length, start + prefix.length);
      });
    },
    updateCursor(event) {
      const lines = event.target.value.slice(0, event.target.selectionStart).split('\n');
      this.cursor = { line: lines.length, col: lines[lines.length - 1].length + 1 };
    },
    get lineCount() {
      return countLines(this.markdown);
    },
    get gutterText() {
      return Array.from({ length: this.lineCount }, (_, index) => index + 1).join('\n');
    },
    get wordCount() {
      return this.markdown.split(/\s+/).filter(Boolean).length;
    },
    get readMinutes() {
      return Math.max(1, Math.round(this.wordCount / 200));
    },

    // Files

    async openFile() {
      const app = backendApp();
      if (!app?.OpenFile) {
        this.notify('Open is only available inside Wails');
        return;
      }
      try {
        const payload = await app.OpenFile();
        if (!payload) {
          this.statusMessage = 'Open canceled';
          return;
        }

        this.openFilePayload(payload, { closeCleanDefaultTab: true });
      } catch (error) {
        this.notify('Failed to open file');
      }
    },
    async saveFile() {
      const tab = this.activeTab();
      if (!tab || tab.kind !== 'file') {
        this.statusMessage = 'Save is only available for file tabs';
        return;
      }

      const app = backendApp();
      if (!app?.SaveFile) {
        this.notify('Save is only available inside Wails');
        return;
      }
      try {
        const content = tab.markdown;
        const savedPath = await app.SaveFile(content, tab.filePath);
        if (!savedPath) {
          this.statusMessage = 'Save canceled';
          return;
        }

        tab.filePath = savedPath;
        tab.title = this.makeTabTitle(savedPath);
        tab.savedMarkdown = content;
        this.updateDirty(tab);
        // A first save gives the document a folder, so relative image paths can resolve now.
        this.renderNow();
        this.notify(`Saved ${filenameFromPath(savedPath)}`);
      } catch (error) {
        this.notify('Failed to save file');
      }
    },
    async copyText(text) {
      if (window.runtime) {
        return ClipboardSetText(text).catch(() => false);
      }
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    },
    async copyRenderedHtml() {
      const copied = await this.copyText(this.exportHtml);
      this.notify(copied ? 'Copied rendered HTML' : 'Could not copy HTML');
    },
    async copyCodeBlock(button) {
      const code = button.closest('.code-block')?.querySelector('pre > code');
      if (!code) {
        return;
      }

      const copied = await this.copyText(code.textContent.replace(/\n$/, ''));
      if (!copied) {
        this.notify('Could not copy code');
        return;
      }

      // Brief check-mark confirmation on the button itself; a re-render simply replaces it.
      const icon = button.firstElementChild;
      button.classList.add('copied');
      icon.className = 'ri-check-line';
      window.setTimeout(() => {
        button.classList.remove('copied');
        icon.className = 'ri-file-copy-line';
      }, 1500);
      this.statusMessage = 'Code copied';
    },
    quitApp() {
      Quit();
    },

    // Scroll sync and outline navigation

    syncPaneScroll(fromElement, toElement, origin) {
      if (!fromElement || !toElement) {
        return;
      }
      if (this.syncOrigin && this.syncOrigin !== origin) {
        return;
      }

      const fromMax = fromElement.scrollHeight - fromElement.clientHeight;
      const toMax = toElement.scrollHeight - toElement.clientHeight;

      if (toMax <= 0) {
        return;
      }

      const ratio = fromMax > 0 ? fromElement.scrollTop / fromMax : 0;
      const targetTop = Math.round(ratio * toMax);

      if (Math.abs(toElement.scrollTop - targetTop) < 1) {
        return;
      }

      this.syncOrigin = origin;
      toElement.scrollTop = targetTop;
      this.releaseScrollSync(50);
    },
    releaseScrollSync(delay) {
      window.clearTimeout(this.syncReleaseTimer);
      this.syncReleaseTimer = window.setTimeout(() => {
        this.syncOrigin = null;
        this.syncReleaseTimer = null;
      }, delay);
    },
    handleSourceScroll(event) {
      if (this.$refs.gutter) {
        this.$refs.gutter.scrollTop = event.target.scrollTop;
      }
      if (!this.showEditor || !this.showPreview) {
        return;
      }

      this.syncPaneScroll(event.target, this.$refs.previewScroller, 'source');
    },
    handlePreviewScroll(event) {
      if (!this.showEditor || !this.showPreview) {
        return;
      }

      this.syncPaneScroll(event.target, this.$refs.editor, 'preview');
    },
    jumpToHeading(index) {
      const item = this.outline[index];
      if (!item) {
        return;
      }

      // Hold proportional sync while both panes jump, or one pane would drag the other off target.
      this.syncOrigin = 'outline';
      this.releaseScrollSync(1000);

      if (this.showPreview) {
        const headings = this.$refs.preview?.querySelectorAll(':scope > h1, :scope > h2, :scope > h3');
        headings?.[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      this.revealEditorLine(item.line);
      this.closeSidebarOnNarrowScreens();
    },
    revealEditorLine(line) {
      const editor = this.$refs.editor;
      if (!editor || !this.showEditor) {
        return;
      }

      const lines = editor.value.split('\n');
      const offset = lines.slice(0, line - 1).join('\n').length + (line > 1 ? 1 : 0);
      editor.focus({ preventScroll: true });
      editor.setSelectionRange(offset, offset);
      this.cursor = { line, col: 1 };

      const lineHeight = parseFloat(window.getComputedStyle(editor).lineHeight) || 24;
      const top = measureOffsetTop(editor, offset);
      editor.scrollTo({ top: Math.max(0, top - lineHeight * 2), behavior: 'smooth' });
    },

    // Preview links

    handlePreviewClick(event) {
      const copyButton = event.target.closest('[data-copy-code]');
      if (copyButton) {
        this.copyCodeBlock(copyButton);
        return;
      }

      const link = event.target.closest('a');
      if (!link) {
        return;
      }

      event.preventDefault();
      const href = link.getAttribute('href');
      if (!href) {
        return;
      }

      const tab = this.activeTab();
      if (this.isUtilityTab(tab) && href === utilityDocs[tab.kind].closeHref) {
        this.toggleUtilityDocument(tab.kind);
        return;
      }

      try {
        BrowserOpenURL(href);
      } catch {
        this.notify('Could not open link in browser');
      }
    },

    // Find in preview

    openSearch() {
      this.isSearching = true;
      this.$nextTick(() => {
        this.$refs.searchInput?.focus();
        this.$refs.searchInput?.select();
        this.refreshSearchResults();
      });
    },
    toggleSearch() {
      if (this.isSearching) {
        this.clearSearch();
        return;
      }

      this.openSearch();
    },
    performSearch() {
      this.searchIndex = 0;
      this.refreshSearchResults({ scrollToCurrent: true });
    },
    refreshSearchResults({ scrollToCurrent = false } = {}) {
      const highlights = window.CSS?.highlights;
      highlights?.delete('search');
      highlights?.delete('search-current');

      const preview = this.$refs.preview;
      const query = this.searchQuery.trim().toLowerCase();
      if (!this.isSearching || !query || !preview) {
        this.searchResultsCount = 0;
        this.searchIndex = -1;
        return;
      }

      const ranges = [];
      const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const text = node.textContent.toLowerCase();
        for (let index = text.indexOf(query); index !== -1; index = text.indexOf(query, index + query.length)) {
          const range = new Range();
          range.setStart(node, index);
          range.setEnd(node, index + query.length);
          ranges.push(range);
        }
      }

      this.searchResultsCount = ranges.length;
      if (ranges.length === 0) {
        this.searchIndex = -1;
        this.statusMessage = 'No matches found';
        return;
      }

      this.searchIndex = Math.min(Math.max(this.searchIndex, 0), ranges.length - 1);
      const current = ranges[this.searchIndex];
      if (highlights && window.Highlight) {
        highlights.set('search', new Highlight(...ranges));
        highlights.set('search-current', new Highlight(current));
      }
      this.statusMessage = `Match ${this.searchIndex + 1} of ${this.searchResultsCount}`;

      if (scrollToCurrent) {
        current.startContainer.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
    stepMatch(direction) {
      if (this.searchResultsCount === 0) {
        return;
      }

      this.searchIndex = (this.searchIndex + direction + this.searchResultsCount) % this.searchResultsCount;
      this.refreshSearchResults({ scrollToCurrent: true });
    },
    nextMatch() {
      this.stepMatch(1);
    },
    prevMatch() {
      this.stepMatch(-1);
    },
    clearSearch() {
      this.searchQuery = '';
      this.searchIndex = -1;
      this.searchResultsCount = 0;
      this.isSearching = false;
      this.refreshSearchResults();
      this.statusMessage = 'Search cleared';
    },

    // Command palette

    get commands() {
      const kind = this.activeTab()?.kind;
      return [
        { id: 'new', label: 'New document', icon: 'ri-file-add-line', keys: 'Ctrl N', run: () => this.newDocument() },
        { id: 'open', label: 'Open file…', icon: 'ri-folder-open-line', keys: 'Ctrl O', run: () => this.openFile() },
        { id: 'save', label: 'Save', icon: 'ri-save-3-line', keys: 'Ctrl S', run: () => this.saveFile() },
        { id: 'undo', label: 'Undo', icon: 'ri-arrow-go-back-line', keys: 'Ctrl Z', run: () => this.undo() },
        { id: 'redo', label: 'Redo', icon: 'ri-arrow-go-forward-line', keys: 'Ctrl Y', run: () => this.redo() },
        { id: 'find', label: 'Find in preview', icon: 'ri-search-line', keys: 'Ctrl F', run: () => this.openSearch() },
        { id: 'clear', label: 'Clear document', icon: 'ri-eraser-line', keys: '', run: () => this.clearDocument() },
        { id: 'sidebar', label: 'Toggle sidebar', icon: 'ri-side-bar-line', keys: 'Ctrl B', run: () => this.toggleSidebar() },
        { id: 'cycle-view', label: 'Cycle view mode', icon: 'ri-loop-right-line', keys: 'Ctrl E', run: () => this.cycleView() },
        { id: 'view-editor', label: 'View: Editor only', icon: 'ri-code-s-slash-line', keys: '', run: () => this.setView('editor') },
        { id: 'view-split', label: 'View: Split', icon: 'ri-layout-column-line', keys: '', run: () => this.setView('split') },
        { id: 'view-preview', label: 'View: Preview only', icon: 'ri-eye-line', keys: '', run: () => this.setView('preview') },
        { id: 'wrap', label: this.wordWrap ? 'Disable word wrap' : 'Enable word wrap', icon: 'ri-text-wrap', keys: 'Alt Z', run: () => this.toggleWordWrap() },
        { id: 'theme', label: this.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme', icon: 'ri-contrast-2-line', keys: '', run: () => this.toggleTheme() },
        { id: 'copy-html', label: 'Copy rendered HTML', icon: 'ri-file-copy-line', keys: '', run: () => this.copyRenderedHtml() },
        { id: 'close-tab', label: 'Close tab', icon: 'ri-close-line', keys: 'Ctrl W', run: () => this.closeTab(this.activeTabId) },
        { id: 'close-all', label: 'Close all tabs', icon: 'ri-close-circle-line', keys: '', run: () => this.closeAllTabs() },
        { id: 'cheatsheet', label: kind === 'cheatsheet' ? 'Close cheat sheet' : 'Markdown cheat sheet', icon: 'ri-book-2-line', keys: 'F1', run: () => this.toggleUtilityDocument('cheatsheet') },
        { id: 'about', label: kind === 'about' ? 'Close about' : 'About mdit', icon: 'ri-information-line', keys: '', run: () => this.toggleUtilityDocument('about') },
        { id: 'quit', label: 'Quit mdit', icon: 'ri-shut-down-line', keys: 'Ctrl Q', run: () => this.quitApp() },
      ];
    },
    get filteredCommands() {
      const query = this.paletteQuery.trim().toLowerCase();
      if (!query) {
        return this.commands;
      }
      return this.commands.filter((command) => command.label.toLowerCase().includes(query));
    },
    openPalette() {
      this.paletteOpen = true;
      this.paletteQuery = '';
      this.paletteIndex = 0;
      this.$nextTick(() => {
        this.$refs.paletteInput?.focus();
        if (this.$refs.paletteList) {
          this.$refs.paletteList.scrollTop = 0;
        }
      });
    },
    togglePalette() {
      if (this.paletteOpen) {
        this.paletteOpen = false;
        return;
      }

      this.openPalette();
    },
    movePalette(step) {
      const count = this.filteredCommands.length;
      if (count === 0) {
        return;
      }

      this.paletteIndex = (this.paletteIndex + step + count) % count;
      this.$nextTick(() => {
        this.$refs.paletteList?.querySelector(`[data-index="${this.paletteIndex}"]`)?.scrollIntoView({ block: 'nearest' });
      });
    },
    hoverCommand(event, index) {
      // Browsers fire synthetic mousemove when the list scrolls under a resting pointer; only follow real movement.
      const point = `${event.screenX},${event.screenY}`;
      if (point === this.palettePointer) {
        return;
      }

      this.palettePointer = point;
      this.paletteIndex = index;
    },
    runCommand(command) {
      if (!command) {
        return;
      }

      this.paletteOpen = false;
      command.run();
    },

    // Feedback

    notify(message) {
      this.statusMessage = message;
      this.toast = message;
      window.clearTimeout(this.toastTimer);
      this.toastTimer = window.setTimeout(() => {
        this.toast = '';
      }, 2200);
    },

    // Keyboard

    handleEscape() {
      if (this.paletteOpen) {
        this.paletteOpen = false;
        return;
      }
      if (this.isSearching) {
        this.clearSearch();
        return;
      }
      this.closeSidebarOnNarrowScreens();
    },
    handleGlobalKeydown(event) {
      if (event.key === 'Escape') {
        this.handleEscape();
        return;
      }

      if (event.key === 'F1') {
        event.preventDefault();
        this.toggleUtilityDocument('cheatsheet');
        return;
      }

      const hasPrimaryModifier = event.ctrlKey || event.metaKey;
      if (event.altKey && !hasPrimaryModifier && event.code === 'KeyZ') {
        event.preventDefault();
        this.toggleWordWrap();
        return;
      }

      if (!hasPrimaryModifier) {
        return;
      }

      const key = event.key.toLowerCase();
      const actions = {
        k: () => this.togglePalette(),
        o: () => this.openFile(),
        s: () => this.saveFile(),
        n: () => this.newDocument(),
        w: () => this.activeTabId !== null && this.closeTab(this.activeTabId),
        b: () => this.toggleSidebar(),
        e: () => this.cycleView(),
        f: () => this.openSearch(),
        q: () => this.quitApp(),
        y: () => this.redo(),
        z: () => (event.shiftKey ? this.redo() : this.undo()),
        tab: () => this.activateAdjacentTab(event.shiftKey ? -1 : 1),
      };

      if (!actions[key]) {
        return;
      }

      event.preventDefault();
      actions[key]();
    },
  };
};

document.querySelector('#app').innerHTML = `
  <div class="flex h-full select-none flex-col bg-bg font-sans text-fg antialiased" x-data="markdownViewer()" x-cloak @keydown.window="handleGlobalKeydown($event)">

    <header class="flex h-12 shrink-0 items-center gap-1.5 border-b border-line bg-surface px-2">
      <button type="button" class="icon-btn" title="Toggle sidebar (Ctrl B)" @click="toggleSidebar()">
        <i :class="sidebarOpen ? 'ri-side-bar-fill' : 'ri-side-bar-line'"></i>
      </button>

      <div class="mr-1 flex shrink-0 items-center gap-2 pl-1 pr-2">
        <div class="grid size-7 place-items-center rounded-lg bg-linear-to-br from-cyan-400 to-teal-500 text-[15px] text-slate-950 shadow-[0_0_18px_-4px_rgb(34_211_238/0.6)]">
          <i class="ri-markdown-fill"></i>
        </div>
        <span class="hidden text-[14px] font-semibold tracking-tight sm:inline">mdit</span>
      </div>

      <nav class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]" role="tablist">
        <template x-for="tab in tabs" :key="tab.id">
          <div
            role="tab"
            class="doc-tab group"
            :class="tab.id === activeTabId && 'doc-tab-active'"
            :aria-selected="tab.id === activeTabId"
            :title="tabTooltip(tab)"
            @click="setActiveTab(tab.id)"
            @auxclick.prevent="$event.button === 1 && closeTab(tab.id)"
          >
            <i :class="[tabIcon(tab), isUtilityTab(tab) ? 'text-violet-400' : 'text-accent']"></i>
            <span class="max-w-40 truncate" x-text="tab.title"></span>
            <button type="button" class="relative grid size-5 place-items-center rounded-md hover:bg-fg/10" title="Close tab (Ctrl W)" @click.stop="closeTab(tab.id)">
              <span class="size-2 rounded-full bg-amber-400" :class="tab.isDirty ? 'block group-hover:hidden' : 'hidden'"></span>
              <i class="ri-close-line text-[14px]" :class="tab.isDirty ? 'hidden group-hover:block' : (tab.id === activeTabId ? 'block' : 'block opacity-0 group-hover:opacity-100')"></i>
            </button>
          </div>
        </template>
        <button type="button" class="icon-btn-sm" title="New document (Ctrl N)" @click="newDocument()"><i class="ri-add-line"></i></button>
      </nav>

      <button
        type="button"
        class="hidden h-8 w-72 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-bg/60 px-2.5 text-[13px] text-muted transition hover:border-accent/40 hover:text-fg lg:flex"
        @click="openPalette()"
      >
        <i class="ri-search-line"></i>
        <span class="flex-1 truncate text-left">Search or run a command</span>
        <span class="kbd">Ctrl K</span>
      </button>
      <button type="button" class="icon-btn lg:hidden" title="Command palette (Ctrl K)" @click="openPalette()"><i class="ri-command-line"></i></button>

      <div
        class="hidden shrink-0 items-center rounded-lg bg-bg/60 p-0.5 ring-1 ring-line sm:flex"
        role="radiogroup"
        aria-label="View mode"
        :title="isUtility ? 'Read-only documents have no source view. Use “Edit a copy” to change it.' : 'Switch view (Ctrl E)'"
      >
        <template x-for="mode in viewModes" :key="mode.id">
          <button
            type="button"
            class="flex h-7 min-w-8 items-center justify-center gap-1.5 rounded-md px-2 text-[15px] transition disabled:cursor-not-allowed disabled:opacity-40"
            :class="view === mode.id && !isUtility ? 'bg-elevated text-accent shadow-sm' : 'text-muted hover:text-fg'"
            :title="isUtility ? '' : mode.label"
            :aria-checked="view === mode.id"
            :disabled="isUtility"
            @click="setView(mode.id)"
          >
            <i :class="mode.icon"></i>
            <span class="hidden text-[12.5px] font-medium xl:inline" x-text="mode.label"></span>
          </button>
        </template>
      </div>

      <button type="button" class="icon-btn" :title="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'" @click="toggleTheme()">
        <i :class="theme === 'dark' ? 'ri-sun-line' : 'ri-moon-clear-line'"></i>
      </button>
    </header>

    <div class="relative flex min-h-0 flex-1">
      <div x-show="sidebarOpen" x-transition.opacity class="absolute inset-0 z-20 bg-slate-950/40 lg:hidden" @click="sidebarOpen = false"></div>
      <aside
        x-show="sidebarOpen"
        x-transition:enter="transition duration-150 ease-out"
        x-transition:enter-start="-translate-x-4 opacity-0"
        x-transition:leave="transition duration-100 ease-in"
        x-transition:leave-end="-translate-x-4 opacity-0"
        class="flex w-64 shrink-0 flex-col border-r border-line bg-surface max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-30 max-lg:shadow-2xl"
      >
        <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          <div class="section-label flex items-center justify-between">
            <span>Open documents</span>
            <span class="rounded-full bg-elevated px-1.5 text-[10px] font-medium normal-case tracking-normal" x-text="tabs.length"></span>
          </div>
          <template x-for="tab in tabs" :key="'side-' + tab.id">
            <button type="button" class="side-item" :class="tab.id === activeTabId && 'side-item-active'" :title="tabTooltip(tab)" @click="activateFromSidebar(tab.id)">
              <i class="text-[15px]" :class="[tabIcon(tab), isUtilityTab(tab) ? 'text-violet-400' : 'text-accent']"></i>
              <span class="min-w-0 flex-1 truncate" x-text="tab.title"></span>
              <span x-show="tab.isDirty" class="size-1.5 rounded-full bg-amber-400" title="Unsaved changes"></span>
            </button>
          </template>

          <div class="section-label">Outline</div>
          <template x-for="(item, index) in outline" :key="activeTabId + '-' + index">
            <button
              type="button"
              class="side-item py-1!"
              :style="'padding-left: ' + (0.75 + (item.depth - 1) * 0.85) + 'rem'"
              :title="'Line ' + item.line"
              @click="jumpToHeading(index)"
            >
              <span class="text-[10px] font-semibold text-muted/60" x-text="'H' + item.depth"></span>
              <span class="min-w-0 flex-1 truncate" :class="item.depth === 1 && 'font-medium text-fg'" x-text="item.text"></span>
            </button>
          </template>
          <p x-show="outline.length === 0" class="px-3 text-[12px] text-muted">No headings yet.</p>
        </div>

        <div class="m-2 rounded-xl border border-line bg-elevated/60 p-3 text-[12px] leading-relaxed text-muted">
          <div class="mb-1 flex items-center gap-1.5 font-medium text-fg"><i class="ri-lightbulb-flash-line text-accent"></i> Tip</div>
          Press <span class="kbd">Ctrl K</span> to search commands, open files and switch views.
        </div>
      </aside>

      <main class="flex min-w-0 flex-1 flex-col">
        <div class="flex h-11 shrink-0 items-center gap-2 px-4">
          <div class="flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
            <template x-if="activeDirectory()">
              <span class="flex min-w-0 items-center gap-1.5" :title="activeTab()?.filePath">
                <i class="ri-folder-3-line"></i>
                <span class="truncate [direction:rtl]"><bdi x-text="activeDirectory()"></bdi></span>
                <i class="ri-arrow-right-s-line text-muted/60"></i>
              </span>
            </template>
            <span class="max-w-72 shrink-0 truncate font-medium text-fg" x-text="activeTab()?.title"></span>
          </div>
          <span
            x-show="!isUtility"
            class="chip"
            :class="activeTab()?.isDirty ? 'bg-amber-400/12 text-amber-500' : 'bg-emerald-400/12 text-emerald-500'"
          >
            <i :class="activeTab()?.isDirty ? 'ri-edit-circle-line' : 'ri-checkbox-circle-line'"></i>
            <span x-text="activeTab()?.isDirty ? 'Edited' : 'Saved'"></span>
          </span>
          <span x-show="isUtility" class="chip bg-violet-400/12 text-violet-400">Read-only</span>

          <div class="ml-auto flex items-center gap-1.5">
            <button type="button" class="action-btn" title="Undo (Ctrl Z)" :disabled="isUtility" @click="undo()">
              <i class="ri-arrow-go-back-line"></i><span class="hidden lg:inline">Undo</span>
            </button>
            <button type="button" class="action-btn" title="Redo (Ctrl Y)" :disabled="isUtility" @click="redo()">
              <i class="ri-arrow-go-forward-line"></i><span class="hidden lg:inline">Redo</span>
            </button>
            <button type="button" class="action-btn" title="Find in preview (Ctrl F)" @click="openSearch()">
              <i class="ri-search-line"></i><span class="hidden lg:inline">Find</span>
            </button>
            <button type="button" class="action-btn" title="Open file (Ctrl O)" @click="openFile()">
              <i class="ri-folder-open-line"></i><span class="hidden lg:inline">Open</span>
            </button>
            <button
              type="button"
              class="action-btn"
              :class="activeTab()?.isDirty && 'action-btn-primary'"
              title="Save (Ctrl S)"
              :disabled="isUtility"
              @click="saveFile()"
            >
              <i class="ri-save-3-line"></i><span class="hidden lg:inline">Save</span>
            </button>
          </div>
        </div>

        <div class="relative flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 md:flex-row">
          <div
            x-show="isSearching"
            x-transition
            class="absolute right-6 top-14 z-10 flex items-center gap-1 rounded-xl border border-line bg-surface/95 p-1 pl-3 shadow-xl backdrop-blur"
          >
            <i class="ri-search-line text-muted"></i>
            <input
              type="text"
              x-ref="searchInput"
              x-model="searchQuery"
              class="w-40 bg-transparent px-1 text-[13px] outline-hidden placeholder:text-muted/70 sm:w-52"
              placeholder="Find in preview"
              @input.debounce.150ms="performSearch()"
              @keydown.enter.prevent="$event.shiftKey ? prevMatch() : nextMatch()"
            />
            <span class="min-w-14 text-right text-[11px] tabular-nums text-muted" x-text="searchQuery.trim() ? (searchResultsCount ? (searchIndex + 1) + ' / ' + searchResultsCount : 'No results') : ''"></span>
            <button type="button" class="icon-btn-sm" title="Previous match (Shift Enter)" @click="prevMatch()"><i class="ri-arrow-up-s-line"></i></button>
            <button type="button" class="icon-btn-sm" title="Next match (Enter)" @click="nextMatch()"><i class="ri-arrow-down-s-line"></i></button>
            <button type="button" class="icon-btn-sm" title="Close (Esc)" @click="clearSearch()"><i class="ri-close-line"></i></button>
          </div>

          <section x-show="showEditor" class="pane">
            <div class="pane-head">
              <span class="pane-title">Markdown</span>
              <button type="button" x-show="view === 'editor'" class="pane-toggle" title="Show preview (Ctrl E)" @click="setView('split')">
                <i class="ri-eye-line"></i> Show preview
              </button>
              <div class="ml-auto flex items-center gap-0.5">
                <button type="button" class="icon-btn-sm" title="Heading" @click="prefixLine('## ')"><i class="ri-heading"></i></button>
                <button type="button" class="icon-btn-sm" title="Bold" @click="wrapSelection('**')"><i class="ri-bold"></i></button>
                <button type="button" class="icon-btn-sm" title="Italic" @click="wrapSelection('*')"><i class="ri-italic"></i></button>
                <span class="mx-1 h-4 w-px bg-line"></span>
                <button type="button" class="icon-btn-sm" title="Link" @click="wrapSelection('[', '](https://)', 'link')"><i class="ri-link"></i></button>
                <button type="button" class="icon-btn-sm" title="Inline code" @click="wrapSelection('\`', '\`', 'code')"><i class="ri-code-line"></i></button>
                <button type="button" class="icon-btn-sm hidden sm:grid" title="Quote" @click="prefixLine('> ')"><i class="ri-double-quotes-l"></i></button>
                <button type="button" class="icon-btn-sm hidden sm:grid" title="Task" @click="prefixLine('- [ ] ')"><i class="ri-checkbox-line"></i></button>
                <span class="mx-1 h-4 w-px bg-line"></span>
                <button type="button" class="icon-btn-sm" :class="wordWrap && 'bg-accent/10 text-accent!'" title="Word wrap (Alt Z)" @click="toggleWordWrap()"><i class="ri-text-wrap"></i></button>
              </div>
            </div>
            <div class="flex min-h-0 flex-1">
              <div x-show="!wordWrap" x-ref="gutter" class="w-12 shrink-0 select-none overflow-hidden pb-[75vh] pl-2 pr-3 pt-4 text-right font-mono text-[12px] leading-6 text-gutter" aria-hidden="true">
                <div class="relative">
                  <div class="whitespace-pre" x-text="gutterText"></div>
                  <div class="absolute inset-x-0 bg-surface text-accent" :style="'top: ' + (cursor.line - 1) * 1.5 + 'rem'" x-text="cursor.line"></div>
                </div>
              </div>
              <label class="sr-only" for="editor">Markdown editor</label>
              <textarea
                id="editor"
                x-ref="editor"
                x-model="markdown"
                :wrap="wordWrap ? 'soft' : 'off'"
                spellcheck="false"
                class="min-h-0 flex-1 resize-none select-text bg-transparent pb-[75vh] pr-4 pt-4 font-mono text-[13px] leading-6 text-fg caret-accent outline-hidden selection:bg-accent/25 placeholder:text-muted/60"
                :class="wordWrap ? 'pl-4' : 'pl-1'"
                placeholder="# Start writing…"
                :readonly="isUtility"
                @input="handleEditorInput($event)"
                @scroll="handleSourceScroll($event)"
                @keyup="updateCursor($event)"
                @click="updateCursor($event)"
              ></textarea>
            </div>
          </section>

          <section x-show="showPreview" class="pane">
            <div class="pane-head">
              <span class="pane-title">Preview</span>
              <button type="button" x-show="view === 'preview' && !isUtility" class="pane-toggle" title="Show source (Ctrl E)" @click="setView('split')">
                <i class="ri-code-s-slash-line"></i> Show source
              </button>
              <button type="button" x-show="isUtility" class="pane-toggle" title="Open an editable copy as a new document" @click="editUtilityCopy()">
                <i class="ri-file-copy-2-line"></i> Edit a copy
              </button>
              <span class="ml-auto text-[12px] text-muted" x-text="readMinutes + ' min read'"></span>
            </div>
            <div id="preview-scroller" x-ref="previewScroller" class="min-h-0 flex-1 overflow-y-auto" @scroll="handlePreviewScroll($event)">
              <article
                id="preview"
                x-ref="preview"
                class="markdown-preview mx-auto max-w-3xl px-6 pb-[75vh] pt-8 sm:px-10"
                x-html="renderedHtml"
                @click="handlePreviewClick($event)"
              ></article>
            </div>
          </section>
        </div>
      </main>
    </div>

    <footer class="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-surface px-3 text-[11.5px] text-muted">
      <span class="flex shrink-0 items-center gap-1.5">
        <span class="size-1.5 rounded-full" :class="activeTab()?.isDirty ? 'bg-amber-400' : 'bg-emerald-400'"></span>
        <span x-text="isUtility ? 'Read-only document' : (activeTab()?.isDirty ? 'Unsaved changes' : 'All changes saved')"></span>
      </span>
      <span class="hidden min-w-0 truncate text-muted/80 md:inline" x-text="statusMessage"></span>
      <span class="ml-auto shrink-0 tabular-nums" x-show="showEditor" x-text="'Ln ' + cursor.line + ', Col ' + cursor.col"></span>
      <span class="shrink-0 tabular-nums" x-text="wordCount + ' words'"></span>
      <span class="hidden shrink-0 sm:inline">UTF-8</span>
      <span class="hidden shrink-0 items-center gap-1 sm:flex"><i class="ri-markdown-line"></i> Markdown</span>
    </footer>

    <div
      x-show="paletteOpen"
      x-transition.opacity.duration.150ms
      class="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 px-4 pt-[12vh] backdrop-blur-sm"
      @click.self="paletteOpen = false"
    >
      <div class="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl" role="dialog" aria-label="Command palette">
        <div class="flex items-center gap-3 border-b border-line px-4">
          <i class="ri-command-line text-lg text-accent"></i>
          <input
            type="text"
            x-ref="paletteInput"
            x-model="paletteQuery"
            class="h-13 flex-1 bg-transparent text-[15px] outline-hidden placeholder:text-muted/70"
            placeholder="Type a command…"
            @input="paletteIndex = 0"
            @keydown.arrow-down.prevent="movePalette(1)"
            @keydown.arrow-up.prevent="movePalette(-1)"
            @keydown.enter.prevent="runCommand(filteredCommands[paletteIndex])"
          />
          <span class="kbd">Esc</span>
        </div>
        <ul x-ref="paletteList" class="max-h-80 scroll-py-1.5 overflow-y-auto p-1.5">
          <template x-for="(command, index) in filteredCommands" :key="command.id">
            <li>
              <button
                type="button"
                class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13.5px]"
                :class="index === paletteIndex ? 'bg-accent/12 text-fg' : 'text-muted'"
                :data-index="index"
                @mousemove="hoverCommand($event, index)"
                @click="runCommand(command)"
              >
                <i class="text-[16px]" :class="[command.icon, index === paletteIndex && 'text-accent']"></i>
                <span class="flex-1" x-text="command.label"></span>
                <span x-show="command.keys" class="kbd" x-text="command.keys"></span>
              </button>
            </li>
          </template>
          <li x-show="filteredCommands.length === 0" class="px-3 py-6 text-center text-[13px] text-muted">No matching commands</li>
        </ul>
        <div class="flex items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-muted">
          <span><span class="kbd">↑</span> <span class="kbd">↓</span> navigate</span>
          <span><span class="kbd">↵</span> run</span>
          <span><span class="kbd">Esc</span> close</span>
        </div>
      </div>
    </div>

    <div
      x-show="toast"
      x-transition
      class="fixed bottom-10 right-4 z-50 flex items-center gap-2 rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-[13px] shadow-2xl"
    >
      <i class="ri-information-line text-accent"></i>
      <span x-text="toast"></span>
    </div>
  </div>
`;

window.Alpine = Alpine;
Alpine.start();
