// Files: part of the markdownViewer Alpine component (merged in viewer/index.js).

import { ClipboardSetText, Quit } from '../../wailsjs/runtime/runtime';
import { filenameFromPath } from '../lib/paths';
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
};
