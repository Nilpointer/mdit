import './style.css';

import Alpine from 'alpinejs';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

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

window.markdownViewer = () => ({
  markdown: initialMarkdown,
  renderedHtml: '',
  statusMessage: 'Ready',
  currentFilePath: '',
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
        { label: 'Export HTML', action: 'ExportHTML' },
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
        { label: 'Focus Editor', action: 'FocusEditor' },
        { label: 'Focus Preview', action: 'FocusPreview' },
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
  renderNow() {
    const rawHtml = marked.parse(this.markdown);
    this.renderedHtml = DOMPurify.sanitize(rawHtml);
    this.statusMessage = 'Preview updated';
  },
  fileLabel() {
    if (this.currentFilePath) {
      return filenameFromPath(this.currentFilePath);
    }
    return `${this.markdown.length} chars`;
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
        this.markdown = content;
        this.currentFilePath = path;
        this.renderNow();
        this.statusMessage = `Opened ${filenameFromPath(path)}`;
      } catch (error) {
        this.statusMessage = 'Failed to open file';
      }
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

    if (action === 'ExportHTML') {
      const app = backendApp();
      if (!app?.ExportHTML) {
        this.statusMessage = 'Export is only available inside Wails';
        this.closeMenu();
        return;
      }
      try {
        this.renderNow();
        const exportPath = await app.ExportHTML(this.renderedHtml, this.currentFilePath);
        if (!exportPath) {
          this.statusMessage = 'Export canceled';
          this.closeMenu();
          return;
        }

        this.statusMessage = `Exported ${filenameFromPath(exportPath)}`;
      } catch (error) {
        this.statusMessage = 'Failed to export HTML';
      }
      this.closeMenu();
      return;
    }

    if (action === 'ClearDocument') {
      this.markdown = '';
      this.currentFilePath = '';
      this.renderNow();
      this.statusMessage = 'Cleared document';
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
                    x-text="item.label"
                  ></button>
                </template>
              </div>
            </div>
          </template>
        </nav>
      </div>
    </header>

    <main class="grid h-[calc(100vh-3rem)] grid-cols-1 gap-px bg-slate-700 md:grid-cols-2">
      <section class="flex h-full min-h-0 flex-col bg-slate-900/70">
        <div class="flex items-center justify-between border-b border-slate-700 px-4 py-2 text-sm">
          <h2 class="font-semibold tracking-wide text-slate-100">Markdown Source</h2>
          <span class="font-mono text-xs text-slate-400" x-text="fileLabel()"></span>
        </div>
        <label class="sr-only" for="editor">Markdown editor</label>
        <textarea
          id="editor"
          x-model="markdown"
          @input="scheduleRender()"
          class="h-full w-full resize-none border-0 bg-slate-900/40 p-4 font-mono text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500"
          placeholder="# Start writing markdown..."
          spellcheck="false"
        ></textarea>
      </section>

      <section class="flex h-full min-h-0 flex-col bg-slate-900/60">
        <div class="flex items-center justify-between border-b border-slate-700 px-4 py-2 text-sm">
          <h2 class="font-semibold tracking-wide text-slate-100">Rendered Preview</h2>
          <span class="text-xs text-cyan-300" x-text="statusMessage"></span>
        </div>
        <article
          class="markdown-preview h-full overflow-y-auto p-5 text-left"
          x-html="renderedHtml"
          @click="handlePreviewClick($event)"
        ></article>
      </section>
    </main>
  </div>
`;

window.Alpine = Alpine;
Alpine.start();
