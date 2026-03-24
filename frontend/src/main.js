import './style.css';

import Alpine from 'alpinejs';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import cheatSheetMarkdown from './assets/markdown/cheatsheet.md?raw';

import { BrowserOpenURL } from '../wailsjs/runtime/runtime';

const initialMarkdown = `# mdit Markdown Viewer

Welcome to your Wails markdown editor.

## Features

- Live preview while you type
- Vertical split source and preview panes
- Top menu bar ready for future functions

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

const cheatSheetCloseHref = '#close-cheatsheet';

window.markdownViewer = () => ({
  markdown: initialMarkdown,
  renderedHtml: '',
  statusMessage: 'Ready',
  currentFilePath: '',
  showSourcePane: true,
  showPreviewPane: true,
  isCheatSheetOpen: false,
  savedDocumentState: null,
  history: [initialMarkdown],
  historyIndex: 0,
  historyLimit: 200,
  syncOrigin: null,
  syncReleaseTimer: null,
  openMenu: null,
  menuAlignment: {},
  renderTimer: null,
  menus: [
    {
      id: 'file',
      label: 'File',
      items: [
        { label: 'Open', action: 'OpenFile' },
        { label: 'Save', action: 'SaveFile' },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        { label: 'Undo', action: 'Undo' },
        { label: 'Redo', action: 'Redo' },
        { label: 'Clear Document', action: 'ClearDocument' },
      ],
    },
    {
      id: 'view',
      label: 'View',
      items: [
        { label: 'Toggle Source Pane', action: 'ToggleSourcePane' },
        { label: 'Toggle Preview Pane', action: 'TogglePreviewPane' },
      ],
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        { label: 'Markdown Cheat Sheet', action: 'CheatSheet' },
        { label: 'About mdit', action: 'About' },
      ],
    },
  ],
  init() {
    this.renderNow();
  },
  scheduleRender() {
    window.clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => this.renderNow(), 80);
  },
  recordHistory(nextValue) {
    if (nextValue === this.history[this.historyIndex]) {
      return;
    }

    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(nextValue);
    if (this.history.length > this.historyLimit) {
      const overflow = this.history.length - this.historyLimit;
      this.history.splice(0, overflow);
    }
    this.historyIndex = this.history.length - 1;
  },
  resetHistory(initialValue) {
    this.history = [initialValue];
    this.historyIndex = 0;
  },
  applyMarkdown(nextValue, options = {}) {
    const { resetHistory = false, recordHistory = true } = options;
    this.markdown = nextValue;
    if (resetHistory) {
      this.resetHistory(nextValue);
    } else if (recordHistory) {
      this.recordHistory(nextValue);
    }
    this.renderNow();
  },
  undo() {
    if (this.historyIndex === 0) {
      this.statusMessage = 'Nothing to undo';
      return;
    }

    this.historyIndex -= 1;
    this.markdown = this.history[this.historyIndex] ?? '';
    this.renderNow();
    this.statusMessage = 'Undo';
  },
  redo() {
    if (this.historyIndex >= this.history.length - 1) {
      this.statusMessage = 'Nothing to redo';
      return;
    }

    this.historyIndex += 1;
    this.markdown = this.history[this.historyIndex] ?? '';
    this.renderNow();
    this.statusMessage = 'Redo';
  },
  handleEditorInput(value) {
    this.recordHistory(value);
    this.scheduleRender();
  },
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
    window.clearTimeout(this.syncReleaseTimer);
    this.syncReleaseTimer = window.setTimeout(() => {
      this.syncOrigin = null;
      this.syncReleaseTimer = null;
    }, 50);
  },
  handleSourceScroll(event) {
    if (!this.showSourcePane || !this.showPreviewPane) {
      return;
    }

    const source = event.target;
    const preview = document.getElementById('preview');
    this.syncPaneScroll(source, preview, 'source');
  },
  handlePreviewScroll(event) {
    if (!this.showSourcePane || !this.showPreviewPane) {
      return;
    }

    const preview = event.target;
    const source = document.getElementById('editor');
    this.syncPaneScroll(preview, source, 'preview');
  },
  renderNow() {
    const rawHtml = marked.parse(this.markdown);
    this.renderedHtml = DOMPurify.sanitize(rawHtml);
    this.statusMessage = 'Preview updated';
  },
  fileLabel() {
    if (this.isCheatSheetOpen) {
      return 'Markdown Cheat Sheet';
    }
    if (this.currentFilePath) {
      return filenameFromPath(this.currentFilePath);
    }
    return `${this.markdown.length} chars`;
  },
  menuItemLabel(item) {
    if (item.action === 'CheatSheet') {
      return this.isCheatSheetOpen ? 'Close Cheat Sheet' : 'Markdown Cheat Sheet';
    }
    if (item.action === 'ToggleSourcePane') {
      return this.showSourcePane ? 'Hide Source Pane' : 'Show Source Pane';
    }
    if (item.action === 'TogglePreviewPane') {
      return this.showPreviewPane ? 'Hide Preview Pane' : 'Show Preview Pane';
    }
    return item.label;
  },
  mainLayoutClass() {
    return this.showSourcePane && this.showPreviewPane
      ? 'grid h-[calc(100vh-3rem)] grid-cols-1 gap-px bg-slate-700 md:grid-cols-2'
      : 'grid h-[calc(100vh-3rem)] grid-cols-1 gap-px bg-slate-700';
  },
  toggleSourcePane() {
    if (this.showSourcePane && !this.showPreviewPane) {
      this.statusMessage = 'At least one pane must remain visible';
      return;
    }

    this.showSourcePane = !this.showSourcePane;
    this.statusMessage = this.showSourcePane ? 'Source pane shown' : 'Source pane hidden';
  },
  togglePreviewPane() {
    if (this.showPreviewPane && !this.showSourcePane) {
      this.statusMessage = 'At least one pane must remain visible';
      return;
    }

    this.showPreviewPane = !this.showPreviewPane;
    this.statusMessage = this.showPreviewPane ? 'Preview pane shown' : 'Preview pane hidden';
  },
  toggleMenu(menuId, event) {
    if (this.openMenu === menuId) {
      this.openMenu = null;
      return;
    }

    const triggerRect = event?.currentTarget?.getBoundingClientRect();
    const panelWidth = 192;
    const viewportPadding = 8;
    const shouldAlignRight = triggerRect
      ? triggerRect.left + panelWidth > window.innerWidth - viewportPadding
      : false;

    this.menuAlignment[menuId] = shouldAlignRight ? 'right' : 'left';
    this.openMenu = menuId;
  },
  menuPanelClass(menuId) {
    return this.menuAlignment[menuId] === 'right' ? 'right-0' : 'left-0';
  },
  closeMenu() {
    this.openMenu = null;
  },
  openCheatSheet() {
    if (this.isCheatSheetOpen) {
      this.statusMessage = 'Cheat sheet already open';
      return;
    }

    this.savedDocumentState = {
      markdown: this.markdown,
      currentFilePath: this.currentFilePath,
      history: [...this.history],
      historyIndex: this.historyIndex,
    };

    this.isCheatSheetOpen = true;
    this.applyMarkdown(cheatSheetMarkdown, { resetHistory: true, recordHistory: false });
    this.currentFilePath = '';
    this.statusMessage = 'Cheat sheet opened';
  },
  closeCheatSheet() {
    if (!this.isCheatSheetOpen) {
      return;
    }

    const fallbackState = {
      markdown: initialMarkdown,
      currentFilePath: '',
      history: [initialMarkdown],
      historyIndex: 0,
    };
    const state = this.savedDocumentState ?? fallbackState;

    this.isCheatSheetOpen = false;
    this.markdown = state.markdown;
    this.currentFilePath = state.currentFilePath;
    this.history = state.history.length > 0 ? [...state.history] : [state.markdown];
    this.historyIndex = Math.min(Math.max(state.historyIndex, 0), this.history.length - 1);
    this.renderNow();
    this.savedDocumentState = null;
    this.statusMessage = 'Cheat sheet closed';
  },
  async handleMenuAction(action) {
    if (action === 'CheatSheet') {
      if (this.isCheatSheetOpen) {
        this.closeCheatSheet();
      } else {
        this.openCheatSheet();
      }
      this.closeMenu();
      return;
    }

    if (this.isCheatSheetOpen && (action === 'OpenFile' || action === 'SaveFile' || action === 'ClearDocument')) {
      this.statusMessage = 'Close cheat sheet first to edit files';
      this.closeMenu();
      return;
    }

    if (action === 'OpenFile') {
      const app = backendApp();
      if (!app?.OpenFile) {
        this.statusMessage = 'Open is only available inside Wails';
        this.closeMenu();
        return;
      }
      try {
        const payload = await app.OpenFile();
        if (!payload) {
          this.statusMessage = 'Open canceled';
          this.closeMenu();
          return;
        }

        const content = payload.content ?? payload.Content ?? '';
        const path = payload.path ?? payload.Path ?? '';
        this.applyMarkdown(content, { resetHistory: true, recordHistory: false });
        this.currentFilePath = path;
        this.statusMessage = `Opened ${filenameFromPath(path)}`;
      } catch (error) {
        this.statusMessage = 'Failed to open file';
      }
      this.closeMenu();
      return;
    }

    if (action === 'Undo') {
      this.undo();
      this.closeMenu();
      return;
    }

    if (action === 'Redo') {
      this.redo();
      this.closeMenu();
      return;
    }

    if (action === 'SaveFile') {
      const app = backendApp();
      if (!app?.SaveFile) {
        this.statusMessage = 'Save is only available inside Wails';
        this.closeMenu();
        return;
      }
      try {
        const savedPath = await app.SaveFile(this.markdown, this.currentFilePath);
        if (!savedPath) {
          this.statusMessage = 'Save canceled';
          this.closeMenu();
          return;
        }

        this.currentFilePath = savedPath;
        this.statusMessage = `Saved ${filenameFromPath(savedPath)}`;
      } catch (error) {
        this.statusMessage = 'Failed to save file';
      }
      this.closeMenu();
      return;
    }

    if (action === 'ClearDocument') {
      const confirmed = window.confirm('Clear the current document? This can be undone with Edit > Undo.');
      if (!confirmed) {
        this.statusMessage = 'Clear canceled';
        this.closeMenu();
        return;
      }

      this.applyMarkdown('');
      this.currentFilePath = '';
      this.statusMessage = 'Cleared document';
      this.closeMenu();
      return;
    }

    if (action === 'ToggleSourcePane') {
      this.toggleSourcePane();
      this.closeMenu();
      return;
    }

    if (action === 'TogglePreviewPane') {
      this.togglePreviewPane();
      this.closeMenu();
      return;
    }

    this.statusMessage = `${action} is ready for backend wiring`;
    this.closeMenu();
  },
  handlePreviewClick(event) {
    const link = event.target.closest('a');
    if (!link) {
      return;
    }

    event.preventDefault();
    const href = link.getAttribute('href');
    if (!href) {
      return;
    }

    if (href === cheatSheetCloseHref) {
      this.closeCheatSheet();
      return;
    }

    BrowserOpenURL(href).catch(() => {
      this.statusMessage = 'Could not open link in browser';
    });
  },
});

document.querySelector('#app').innerHTML = `
  <div class="h-screen select-none bg-slate-900/90 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100" x-data="markdownViewer()" @keydown.escape.window="closeMenu()" @click="closeMenu()">
    <header class="border-b border-slate-700/80 bg-slate-900/80 backdrop-blur">
      <div class="flex h-12 items-center justify-between px-3 sm:px-4">
        <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/90">
          <span class="inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300"></span>
          mdit
        </div>
        <nav class="flex items-center gap-1 text-sm">
          <template x-for="menu in menus" :key="menu.id">
            <div class="relative">
              <button
                type="button"
                class="rounded-md px-3 py-1.5 text-slate-200 transition hover:bg-slate-700/70"
                @click.stop="toggleMenu(menu.id, $event)"
                :class="openMenu === menu.id ? 'bg-slate-700 text-white' : ''"
                x-text="menu.label"
              ></button>

              <div
                x-show="openMenu === menu.id"
                x-transition
                @click.stop
                class="absolute top-10 z-20 w-48 max-w-[calc(100vw-1rem)] rounded-lg border border-slate-700 bg-slate-900/95 p-1 shadow-panel"
                :class="menuPanelClass(menu.id)"
              >
                <template x-for="item in menu.items" :key="item.action">
                  <button
                    type="button"
                    class="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-700"
                    @click.stop="handleMenuAction(item.action)"
                    x-text="menuItemLabel(item)"
                  ></button>
                </template>
              </div>
            </div>
          </template>
        </nav>
      </div>
    </header>

    <main :class="mainLayoutClass()">
      <section x-show="showSourcePane" class="flex h-full min-h-0 flex-col bg-slate-900/70">
        <div class="flex items-center justify-between border-b border-slate-700 px-4 py-2 text-sm">
          <h2 class="font-semibold tracking-wide text-slate-100">Markdown Source</h2>
          <span class="font-mono text-xs text-slate-400" x-text="fileLabel()"></span>
        </div>
        <label class="sr-only" for="editor">Markdown editor</label>
        <textarea
          id="editor"
          x-model="markdown"
          @input="handleEditorInput($event.target.value)"
          @scroll="handleSourceScroll($event)"
          class="h-full w-full resize-none border-0 bg-slate-900/40 p-4 font-mono text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500"
          placeholder="# Start writing markdown..."
          spellcheck="false"
          :readonly="isCheatSheetOpen"
        ></textarea>
      </section>

      <section x-show="showPreviewPane" class="flex h-full min-h-0 flex-col bg-slate-900/60">
        <div class="flex items-center justify-between border-b border-slate-700 px-4 py-2 text-sm">
          <h2 class="font-semibold tracking-wide text-slate-100">Rendered Preview</h2>
          <span class="text-xs text-cyan-300" x-text="statusMessage"></span>
        </div>
        <article
          id="preview"
          class="markdown-preview h-full overflow-y-auto p-5 text-left"
          x-html="renderedHtml"
          @click="handlePreviewClick($event)"
          @scroll="handlePreviewScroll($event)"
        ></article>
      </section>
    </main>
  </div>
`;

window.Alpine = Alpine;
Alpine.start();
