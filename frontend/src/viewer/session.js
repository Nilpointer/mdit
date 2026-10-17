// Recent files and session restore: part of the markdownViewer Alpine component (merged in viewer/index.js).

import { directoryFromPath, filenameFromPath } from '../lib/paths';
import { loadStored, saveStored } from '../lib/prefs';
import { backendApp } from './constants';

const recentKey = 'mdit.recent';
const sessionKey = 'mdit.session';
const recentLimit = 10;

export const loadRecentFiles = () => {
  const list = loadStored(recentKey, []);
  return Array.isArray(list) ? list.filter((path) => typeof path === 'string' && path) : [];
};

export const sessionPart = {
  rememberRecent(path) {
    if (!path) {
      return;
    }
    this.recentFiles = [path, ...this.recentFiles.filter((entry) => entry !== path)].slice(0, recentLimit);
    saveStored(recentKey, this.recentFiles);
  },
  forgetRecent(path) {
    this.recentFiles = this.recentFiles.filter((entry) => entry !== path);
    saveStored(recentKey, this.recentFiles);
  },
  clearRecentFiles() {
    this.recentFiles = [];
    saveStored(recentKey, []);
    this.statusMessage = 'Recent files cleared';
  },
  // Reads a file through the backend; null when it is missing, unreadable or there is no backend.
  async readFileByPath(path) {
    const app = backendApp();
    if (!app?.ReadFile) {
      return null;
    }
    try {
      return await app.ReadFile(path);
    } catch {
      return null;
    }
  },
  async openRecent(path) {
    const payload = await this.readFileByPath(path);
    if (!payload) {
      this.forgetRecent(path);
      this.notify(`${filenameFromPath(path)} is no longer available and was removed from recent files`);
      return;
    }
    this.openFilePayload(payload, { closeCleanDefaultTab: true });
  },
  get recentCommands() {
    return this.recentFiles.map((path) => ({
      id: `recent:${path}`,
      label: `Open recent: ${filenameFromPath(path)} (${directoryFromPath(path)})`,
      icon: 'ri-history-line',
      keys: '',
      run: () => this.openRecent(path),
    }));
  },
  // Saved file tabs and the active one; untitled and utility tabs are not restored.
  get sessionSnapshot() {
    const paths = this.tabs.filter((tab) => tab.kind === 'file' && tab.filePath).map((tab) => tab.filePath);
    return JSON.stringify({ paths, activePath: this.activeTab()?.filePath ?? '' });
  },
  persistSession(snapshot) {
    saveStored(sessionKey, JSON.parse(snapshot));
  },
  async restoreSession() {
    if (!backendApp()?.ReadFile) {
      return;
    }

    const { paths = [], activePath = '' } = loadStored(sessionKey, {});
    const missing = [];
    for (const path of paths) {
      const payload = await this.readFileByPath(path);
      if (payload) {
        this.openFilePayload(payload, { closeCleanDefaultTab: true, quiet: true });
      } else {
        missing.push(filenameFromPath(path));
      }
    }

    const active = this.tabs.find((tab) => tab.filePath && tab.filePath === activePath);
    if (active) {
      this.setActiveTab(active.id);
    }
    if (missing.length > 0) {
      this.notify(`Could not reopen ${missing.join(', ')}`);
    }
  },
};
