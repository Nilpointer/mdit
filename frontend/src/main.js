import './style.css';

import Alpine from 'alpinejs';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import 'remixicon/fonts/remixicon.css';
import cheatSheetMarkdown from './assets/markdown/cheatsheet.md?raw';
import aboutMarkdown from './assets/markdown/about.md?raw';

import { BrowserOpenURL, Quit } from '../wailsjs/runtime/runtime';

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
const aboutCloseHref = '#close-about';

window.markdownViewer = () => ({
  markdown: initialMarkdown,
  renderedHtml: '',
  statusMessage: 'Ready',
  currentFilePath: '',
  showSourcePane: true,
  showPreviewPane: true,
  activeUtilityDoc: null,
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
        { type: 'divider', action: 'FileDivider' },
        { label: 'Quit', action: 'QuitApp' },
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
    if (this.activeUtilityDoc === 'cheatsheet') {
      return 'Markdown Cheat Sheet';
    }
    if (this.activeUtilityDoc === 'about') {
      return 'About mdit';
    }
    if (this.currentFilePath) {
      return filenameFromPath(this.currentFilePath);
    }
    return `${this.markdown.length} chars`;
  },
  menuItemLabel(item) {
    if (item.action === 'CheatSheet') {
      return this.activeUtilityDoc === 'cheatsheet' ? 'Close Cheat Sheet' : 'Markdown Cheat Sheet';
    }
    if (item.action === 'About') {
      return this.activeUtilityDoc === 'about' ? 'Close About' : 'About mdit';
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
      ? 'grid h-[calc(100vh-5rem)] grid-cols-1 gap-px bg-slate-700 md:grid-cols-2'
      : 'grid h-[calc(100vh-5rem)] grid-cols-1 gap-px bg-slate-700';
  },
  handleIconAction(action) {
    if (action === 'QuitApp') {
      Quit();
    }
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
  openUtilityDocument(kind, content, statusMessage) {
    if (!this.activeUtilityDoc) {
      this.savedDocumentState = {
        markdown: this.markdown,
        currentFilePath: this.currentFilePath,
        history: [...this.history],
        historyIndex: this.historyIndex,
      };
    }

    this.activeUtilityDoc = kind;
    this.applyMarkdown(content, { resetHistory: true, recordHistory: false });
    this.currentFilePath = '';
    this.statusMessage = statusMessage;
  },
  closeUtilityDocument(statusMessage = 'Helper page closed') {
    if (!this.activeUtilityDoc) {
      return;
    }

    const fallbackState = {
      markdown: initialMarkdown,
      currentFilePath: '',
      history: [initialMarkdown],
      historyIndex: 0,
    };
    const state = this.savedDocumentState ?? fallbackState;

    this.activeUtilityDoc = null;
    this.markdown = state.markdown;
    this.currentFilePath = state.currentFilePath;
    this.history = state.history.length > 0 ? [...state.history] : [state.markdown];
    this.historyIndex = Math.min(Math.max(state.historyIndex, 0), this.history.length - 1);
    this.renderNow();
    this.savedDocumentState = null;
    this.statusMessage = statusMessage;
  },
  async handleMenuAction(action) {
    if (action === 'QuitApp') {
      Quit();
      this.closeMenu();
      return;
    }

    if (action === 'CheatSheet') {
      if (this.activeUtilityDoc === 'cheatsheet') {
        this.closeUtilityDocument('Cheat sheet closed');
      } else {
        this.openUtilityDocument('cheatsheet', cheatSheetMarkdown, 'Cheat sheet opened');
      }
      this.closeMenu();
      return;
    }

    if (action === 'About') {
      if (this.activeUtilityDoc === 'about') {
        this.closeUtilityDocument('About page closed');
      } else {
        this.openUtilityDocument('about', aboutMarkdown, 'About page opened');
      }
      this.closeMenu();
      return;
    }

    if (this.activeUtilityDoc && (action === 'OpenFile' || action === 'SaveFile' || action === 'ClearDocument')) {
      this.statusMessage = 'Close helper page first to edit files';
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

    if (href === cheatSheetCloseHref && this.activeUtilityDoc === 'cheatsheet') {
      this.closeUtilityDocument('Cheat sheet closed');
      return;
    }

    if (href === aboutCloseHref && this.activeUtilityDoc === 'about') {
      this.closeUtilityDocument('About page closed');
      return;
    }

    BrowserOpenURL(href).catch(() => {
      this.statusMessage = 'Could not open link in browser';
    });
  },
});

document.querySelector('#app').innerHTML = `
  <div class="app-shell h-screen select-none" x-data="markdownViewer()" @keydown.escape.window="closeMenu()" @click="closeMenu()">
    <header class="app-header">
      <div class="icon-toolbar flex h-10 items-center justify-between px-3 sm:px-4">
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="tool-btn"
            title="Open markdown file"
            @click.stop="handleMenuAction('OpenFile')"
          >
            <i class="ri-folder-open-line text-base"></i>
            <span>Open</span>
          </button>

          <button
            type="button"
            class="tool-btn"
            @click.stop="toggleSourcePane()"
            :title="showSourcePane ? 'Hide left panel' : 'Show left panel'"
          >
            <i class="ri-layout-left-line text-base"></i>
            <span x-text="showSourcePane ? 'Hide Left' : 'Show Left'"></span>
          </button>

          <button
            type="button"
            class="tool-btn"
            @click.stop="togglePreviewPane()"
            :title="showPreviewPane ? 'Hide right panel' : 'Show right panel'"
          >
            <i class="ri-layout-right-line text-base"></i>
            <span x-text="showPreviewPane ? 'Hide Right' : 'Show Right'"></span>
          </button>
        </div>
        <div class="flex items-center gap-1">
          <button
            type="button"
            title="Close mdit"
            aria-label="Close and exit"
            class="tool-btn"
            @click.stop="handleIconAction('QuitApp')"
          >
            <i class="ri-close-line text-base"></i>
            <span>Exit</span>
          </button>
        </div>
      </div>
      <div class="flex h-10 items-center justify-between px-3 sm:px-4">
        <div class="brand-mark flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
          <span class="brand-dot inline-flex h-2.5 w-2.5 rounded-full"></span>
          mdit
        </div>
        <nav class="flex items-center gap-1 text-sm">
          <template x-for="menu in menus" :key="menu.id">
            <div class="relative">
              <button
                type="button"
                class="menu-btn"
                @click.stop="toggleMenu(menu.id, $event)"
                :class="openMenu === menu.id ? 'menu-btn-active' : ''"
                x-text="menu.label"
              ></button>

              <div
                x-show="openMenu === menu.id"
                x-transition
                @click.stop
                class="menu-panel absolute top-10 z-20 w-48 max-w-[calc(100vw-1rem)] p-1 shadow-panel"
                :class="menuPanelClass(menu.id)"
              >
                <template x-for="item in menu.items" :key="item.action">
                  <div>
                    <div x-show="item.type === 'divider'" class="my-1 border-t border-[hsl(var(--s)/0.84)]"></div>
                    <button
                      x-show="item.type !== 'divider'"
                      type="button"
                      class="menu-item"
                      @click.stop="handleMenuAction(item.action)"
                      x-text="menuItemLabel(item)"
                    ></button>
                  </div>
                </template>
              </div>
            </div>
          </template>
        </nav>
      </div>
    </header>

    <main :class="mainLayoutClass()">
      <section x-show="showSourcePane" class="pane flex h-full min-h-0 flex-col">
        <div class="pane-header flex items-center justify-between px-4 py-2 text-sm">
          <h2 class="font-semibold tracking-wide">Markdown Source</h2>
          <span class="pane-meta font-mono text-xs" x-text="fileLabel()"></span>
        </div>
        <label class="sr-only" for="editor">Markdown editor</label>
        <textarea
          id="editor"
          x-model="markdown"
          @input="handleEditorInput($event.target.value)"
          @scroll="handleSourceScroll($event)"
          class="pane-editor h-full w-full resize-none border-0 p-4 font-mono text-sm leading-6 outline-none"
          placeholder="# Start writing markdown..."
          spellcheck="false"
          :readonly="activeUtilityDoc !== null"
        ></textarea>
      </section>

      <section x-show="showPreviewPane" class="pane flex h-full min-h-0 flex-col">
        <div class="pane-header flex items-center justify-between px-4 py-2 text-sm">
          <h2 class="font-semibold tracking-wide">Rendered Preview</h2>
          <span class="status-pill text-xs" x-text="statusMessage"></span>
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
