// Tabs: part of the markdownViewer Alpine component (merged in viewer/index.js).

import { directoryFromPath, filenameFromPath } from '../lib/paths';
import { utilityDocs } from './constants';

export const tabsPart = {
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
};
