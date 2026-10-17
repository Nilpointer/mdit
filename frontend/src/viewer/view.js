// View: part of the markdownViewer Alpine component (merged in viewer/index.js).

import { viewModes } from './constants';

export const viewPart = {
  get showEditor() {
    return !this.isUtility && this.view !== 'preview';
  },
  get showPreview() {
    return this.isUtility || this.view !== 'editor';
  },
  setView(mode) {
    this.view = mode;
  },
  cycleView() {
    if (this.isUtility) {
      this.notify('Read-only document: use “Edit a copy” to see its source');
      return;
    }

    const order = viewModes.map((mode) => mode.id);
    this.view = order[(order.indexOf(this.view) + 1) % order.length];
  },
  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  },
  closeSidebarOnNarrowScreens() {
    if (window.innerWidth < 1024) {
      this.sidebarOpen = false;
    }
  },
  toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    this.applyTheme();
  },
  applyTheme() {
    document.documentElement.dataset.theme = this.theme;
  },
  toggleWordWrap() {
    this.wordWrap = !this.wordWrap;
    this.statusMessage = this.wordWrap ? 'Word wrap on' : 'Word wrap off';
  },
};
