// Reload on external change: part of the markdownViewer Alpine component (merged in viewer/index.js).

import { EventsOn } from '../../wailsjs/runtime/runtime';
import { backendApp } from './constants';

export const watchPart = {
  // JSON so $watch compares by value; the backend watches exactly these files (watcher.go).
  get watchedPaths() {
    return JSON.stringify(this.tabs.filter((tab) => tab.kind === 'file' && tab.filePath).map((tab) => tab.filePath));
  },
  listenForFileChanges() {
    if (!window.runtime) {
      return;
    }

    EventsOn('file-changed', (path) => this.handleExternalChange(path));
    EventsOn('file-removed', (path) => this.handleExternalRemoval(path));
    this.$watch('watchedPaths', (paths) => backendApp()?.SetWatchedFiles?.(JSON.parse(paths)));
    backendApp()?.SetWatchedFiles?.(JSON.parse(this.watchedPaths));
  },
  async handleExternalChange(path) {
    const tab = this.tabs.find((entry) => entry.kind === 'file' && entry.filePath === path);
    if (!tab) {
      return;
    }

    const payload = await this.readFileByPath(path);
    const content = payload?.content;
    // Unreadable, or identical to what was last saved or loaded (for example our own save).
    if (content === undefined || content === tab.savedMarkdown) {
      return;
    }

    if (tab.isDirty && !window.confirm(`${tab.title} changed on disk. Reload it and discard your unsaved changes?`)) {
      // Keep the edits; the tab stays unsaved relative to the new disk version, and saving overwrites it.
      tab.savedMarkdown = content;
      this.updateDirty(tab);
      this.statusMessage = `Kept your changes to ${tab.title}`;
      return;
    }

    this.replaceTabContent(tab, content);
    this.notify(`Reloaded ${tab.title} (changed on disk)`);
  },
  handleExternalRemoval(path) {
    const tab = this.tabs.find((entry) => entry.kind === 'file' && entry.filePath === path);
    if (!tab) {
      return;
    }

    // No saved copy exists anymore, so the tab counts as unsaved until it is saved again.
    tab.savedMarkdown = null;
    this.updateDirty(tab);
    this.notify(`${tab.title} was deleted or moved on disk. Save to keep it.`);
  },
  // Loads new disk content as an undo step, so the previous text can be brought back with Undo.
  replaceTabContent(tab, content) {
    tab.savedMarkdown = content;
    if (tab.id === this.activeTabId) {
      this.applyMarkdownToActive(content);
      return;
    }

    tab.history = [...tab.history.slice(0, tab.historyIndex + 1), content].slice(-this.historyLimit);
    tab.historyIndex = tab.history.length - 1;
    tab.markdown = content;
    this.updateDirty(tab);
  },
};
