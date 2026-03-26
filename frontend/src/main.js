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
  markdown: '',
  renderedHtml: '',
  statusMessage: 'Ready',
  showSourcePane: true,
  showPreviewPane: true,
  tabs: [],
  activeTabId: null,
  nextTabId: 1,
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
    this.createTab({ markdown: initialMarkdown, title: 'untitled.md', kind: 'file' });
    this.renderNow();
  },
  activeTab() {
    return this.tabs.find((tab) => tab.id === this.activeTabId) ?? null;
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
    this.renderNow();
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

    const index = this.tabs.findIndex((entry) => entry.id === tabId);
    if (index < 0) {
      return;
    }

    this.tabs.splice(index, 1);
    if (this.tabs.length === 0) {
      this.createTab({ markdown: '', title: 'untitled.md', kind: 'file' });
      this.statusMessage = 'Created new empty tab';
      return;
    }

    if (this.activeTabId === tabId) {
      const fallbackIndex = Math.max(0, index - 1);
      const fallbackTab = this.tabs[fallbackIndex] ?? this.tabs[0];
      this.setActiveTab(fallbackTab.id);
    }
  },
  closeTabFromButton(tabId, event) {
    event.stopPropagation();
    this.closeTab(tabId);
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
  handleGlobalKeydown(event) {
    const hasPrimaryModifier = event.ctrlKey || event.metaKey;
    if (!hasPrimaryModifier) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === 'o') {
      event.preventDefault();
      this.handleMenuAction('OpenFile');
      return;
    }

    if (key === 's') {
      event.preventDefault();
      this.handleMenuAction('SaveFile');
      return;
    }

    if (key === 'w') {
      event.preventDefault();
      if (this.activeTabId !== null) {
        this.closeTab(this.activeTabId);
      }
      return;
    }

    if (key === 'tab') {
      event.preventDefault();
      this.activateAdjacentTab(event.shiftKey ? -1 : 1);
      return;
    }

    if (key === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        this.redo();
      } else {
        this.undo();
      }
      return;
    }

    if (key === 'y') {
      event.preventDefault();
      this.redo();
    }
  },
  openUtilityDocumentAsTab(kind, title, content) {
    const existing = this.tabs.find((tab) => tab.kind === kind);
    if (existing) {
      this.setActiveTab(existing.id);
      this.statusMessage = `${title} tab focused`;
      return;
    }

    this.createTab({ markdown: content, title, kind, isDirty: false, focus: true });
    this.statusMessage = `${title} opened`;
  },
  isUtilityTab(tab) {
    return tab?.kind === 'cheatsheet' || tab?.kind === 'about';
  },
  scheduleRender() {
    window.clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => this.renderNow(), 80);
  },
  recordHistoryForActive(nextValue) {
    const tab = this.activeTab();
    if (!tab) {
      return;
    }
    if (nextValue === tab.history[tab.historyIndex]) {
      tab.markdown = nextValue;
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
    if (tab.kind === 'file') {
      tab.isDirty = true;
    }
  },
  applyMarkdownToActive(nextValue, options = {}) {
    const { resetHistory = false, recordHistory = true, markDirty = true } = options;
    const tab = this.activeTab();
    if (!tab) {
      return;
    }

    this.markdown = nextValue;
    if (resetHistory) {
      tab.history = [nextValue];
      tab.historyIndex = 0;
      tab.markdown = nextValue;
    } else if (recordHistory) {
      this.recordHistoryForActive(nextValue);
    } else {
      tab.markdown = nextValue;
    }

    if (tab.kind === 'file') {
      tab.isDirty = markDirty;
    }

    this.renderNow();
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
    if (tab.kind === 'file') {
      tab.isDirty = true;
    }
    this.renderNow();
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
    if (tab.kind === 'file') {
      tab.isDirty = true;
    }
    this.renderNow();
    this.statusMessage = 'Redo';
  },
  handleEditorInput(value) {
    const tab = this.activeTab();
    if (!tab || this.isUtilityTab(tab)) {
      return;
    }

    this.markdown = value;
    this.recordHistoryForActive(value);
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
    const tab = this.activeTab();
    if (!tab) {
      return 'untitled.md';
    }

    const dirtyMarker = tab.isDirty ? ' *' : '';
    if (tab.filePath) {
      return `${filenameFromPath(tab.filePath)}${dirtyMarker}`;
    }

    return `${tab.title}${dirtyMarker}`;
  },
  tabTooltip(tab) {
    if (tab.filePath) {
      return tab.filePath;
    }
    return tab.title;
  },
  menuItemLabel(item) {
    if (item.action === 'CheatSheet') {
      return this.activeTab()?.kind === 'cheatsheet' ? 'Close Cheat Sheet' : 'Markdown Cheat Sheet';
    }
    if (item.action === 'About') {
      return this.activeTab()?.kind === 'about' ? 'Close About' : 'About mdit';
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
      ? 'grid h-[calc(100vh-7.5rem)] grid-cols-1 gap-px bg-slate-700 md:grid-cols-2'
      : 'grid h-[calc(100vh-7.5rem)] grid-cols-1 gap-px bg-slate-700';
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
  async handleMenuAction(action) {
    if (action === 'QuitApp') {
      Quit();
      this.closeMenu();
      return;
    }

    if (action === 'CheatSheet') {
      if (this.activeTab()?.kind === 'cheatsheet') {
        this.closeTab(this.activeTabId);
        this.statusMessage = 'Cheat sheet closed';
      } else {
        this.openUtilityDocumentAsTab('cheatsheet', 'Markdown Cheat Sheet', cheatSheetMarkdown);
      }
      this.closeMenu();
      return;
    }

    if (action === 'About') {
      if (this.activeTab()?.kind === 'about') {
        this.closeTab(this.activeTabId);
        this.statusMessage = 'About page closed';
      } else {
        this.openUtilityDocumentAsTab('about', 'About mdit', aboutMarkdown);
      }
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

        const existingTab = this.tabs.find((tab) => tab.kind === 'file' && tab.filePath === path);
        if (existingTab) {
          this.setActiveTab(existingTab.id);
          this.statusMessage = `Focused ${existingTab.title}`;
          this.closeMenu();
          return;
        }

        this.createTab({
          markdown: content,
          filePath: path,
          title: this.makeTabTitle(path),
          kind: 'file',
          isDirty: false,
          focus: true,
        });
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
      const tab = this.activeTab();
      if (!tab || tab.kind !== 'file') {
        this.statusMessage = 'Save is only available for file tabs';
        this.closeMenu();
        return;
      }

      const app = backendApp();
      if (!app?.SaveFile) {
        this.statusMessage = 'Save is only available inside Wails';
        this.closeMenu();
        return;
      }
      try {
        const savedPath = await app.SaveFile(this.markdown, tab.filePath);
        if (!savedPath) {
          this.statusMessage = 'Save canceled';
          this.closeMenu();
          return;
        }

        tab.filePath = savedPath;
        tab.title = this.makeTabTitle(savedPath);
        tab.isDirty = false;
        this.statusMessage = `Saved ${filenameFromPath(savedPath)}`;
      } catch (error) {
        this.statusMessage = 'Failed to save file';
      }
      this.closeMenu();
      return;
    }

    if (action === 'ClearDocument') {
      const tab = this.activeTab();
      if (!tab || tab.kind !== 'file') {
        this.statusMessage = 'Clear is only available for file tabs';
        this.closeMenu();
        return;
      }

      const confirmed = window.confirm('Clear the current document? This can be undone with Edit > Undo.');
      if (!confirmed) {
        this.statusMessage = 'Clear canceled';
        this.closeMenu();
        return;
      }

      this.applyMarkdownToActive('', { resetHistory: false, recordHistory: true, markDirty: true });
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

    if (href === cheatSheetCloseHref && this.activeTab()?.kind === 'cheatsheet') {
      this.closeTab(this.activeTabId);
      this.statusMessage = 'Cheat sheet closed';
      return;
    }

    if (href === aboutCloseHref && this.activeTab()?.kind === 'about') {
      this.closeTab(this.activeTabId);
      this.statusMessage = 'About page closed';
      return;
    }

    BrowserOpenURL(href).catch(() => {
      this.statusMessage = 'Could not open link in browser';
    });
  },
});

document.querySelector('#app').innerHTML = `
  <div class="app-shell h-screen select-none" x-data="markdownViewer()" @keydown.escape.window="closeMenu()" @keydown.window="handleGlobalKeydown($event)" @click="closeMenu()">
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

      <div class="tabbar flex h-10 items-end overflow-x-auto px-3 sm:px-4" @click.stop>
        <template x-for="tab in tabs" :key="tab.id">
          <button
            type="button"
            class="tab-btn"
            :class="activeTabId === tab.id ? 'tab-btn-active' : ''"
            @click="setActiveTab(tab.id)"
            :title="tabTooltip(tab)"
          >
            <span class="truncate" x-text="tab.title + (tab.isDirty ? ' *' : '')"></span>
            <span
              class="tab-close"
              title="Close tab"
              @click="closeTabFromButton(tab.id, $event)"
            >
              <i class="ri-close-line"></i>
            </span>
          </button>
        </template>
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
          :readonly="isUtilityTab(activeTab())"
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
