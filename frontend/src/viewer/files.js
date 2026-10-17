// Files: part of the markdownViewer Alpine component (merged in viewer/index.js).

import { ClipboardSetText, OnFileDrop, Quit } from '../../wailsjs/runtime/runtime';
import { filenameFromPath, isMarkdownPath } from '../lib/paths';
import { backendApp } from './constants';

export const filesPart = {
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
    await this.saveActiveTab('SaveFile');
  },
  async saveFileAs() {
    await this.saveActiveTab('SaveFileAs');
  },
  // method is the backend call: SaveFile (dialog only for untitled tabs) or SaveFileAs (always a dialog).
  async saveActiveTab(method) {
    const tab = this.activeTab();
    if (!tab || tab.kind !== 'file') {
      this.statusMessage = 'Save is only available for file tabs';
      return;
    }

    const app = backendApp();
    if (!app?.[method]) {
      this.notify('Save is only available inside Wails');
      return;
    }
    try {
      const content = tab.markdown;
      const savedPath = await app[method](content, tab.filePath);
      if (!savedPath) {
        this.statusMessage = 'Save canceled';
        return;
      }

      tab.filePath = savedPath;
      tab.title = this.makeTabTitle(savedPath);
      tab.savedMarkdown = content;
      this.updateDirty(tab);
      this.rememberRecent(savedPath);
      // A first save gives the document a folder, so relative image paths can resolve now.
      this.renderNow();
      this.notify(`Saved ${filenameFromPath(savedPath)}`);
    } catch (error) {
      this.notify('Failed to save file');
    }
  },
  listenForFileDrops() {
    if (!window.runtime) {
      return;
    }
    OnFileDrop((x, y, paths) => this.openDroppedFiles(paths), false);
  },
  // Opens dropped Markdown files as tabs and reports the outcome in one message, since each
  // notify replaces the previous toast.
  async openDroppedFiles(paths) {
    const markdownPaths = paths.filter(isMarkdownPath);
    const skipped = paths.length - markdownPaths.length;
    // Read in parallel; tabs still open in drop order.
    const payloads = await Promise.all(markdownPaths.map((path) => this.readFileByPath(path)));

    const failed = [];
    let opened = 0;
    for (const [index, payload] of payloads.entries()) {
      if (!payload) {
        failed.push(filenameFromPath(markdownPaths[index]));
        continue;
      }
      // An already open file is only focused, so it does not count as opened.
      const path = payload.path ?? payload.Path ?? '';
      const alreadyOpen = this.tabs.some((tab) => tab.kind === 'file' && tab.filePath === path);
      this.openFilePayload(payload, { closeCleanDefaultTab: true, quiet: markdownPaths.length > 1 });
      if (!alreadyOpen) {
        opened += 1;
      }
    }

    const parts = [];
    if (opened > 0 && (markdownPaths.length > 1 || failed.length > 0 || skipped > 0)) {
      parts.push(`Opened ${opened} file${opened === 1 ? '' : 's'}`);
    }
    if (failed.length > 0) {
      parts.push(`could not open ${failed.join(', ')}`);
    }
    if (skipped > 0) {
      parts.push(`skipped ${skipped} non-Markdown file${skipped === 1 ? '' : 's'}`);
    }
    // A single dropped file already got its own "Opened"/"Focused" message from openFilePayload.
    if (parts.length > 0) {
      const message = parts.join('; ');
      this.notify(message.charAt(0).toUpperCase() + message.slice(1));
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
};
