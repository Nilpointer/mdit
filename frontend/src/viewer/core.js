// Core state, init and preferences of the markdownViewer Alpine component (merged in viewer/index.js).

import { EventsOn } from '../../wailsjs/runtime/runtime';
import { loadPrefs, savePrefs } from '../lib/prefs';
import { backendApp, initialMarkdown, viewModes } from './constants';

export const createCore = () => {
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
      // The backend asks before closing the window while this count is above zero (lifecycle.go).
      this.$watch('unsavedCount', (count) => backendApp()?.SetUnsavedChanges?.(count));

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
  };
};
