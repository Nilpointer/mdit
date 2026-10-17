// Keyboard: part of the markdownViewer Alpine component (merged in viewer/index.js).

export const keyboardPart = {
  handleEscape() {
    if (this.paletteOpen) {
      this.paletteOpen = false;
      return;
    }
    if (this.isSearching) {
      this.clearSearch();
      return;
    }
    this.closeSidebarOnNarrowScreens();
  },
  handleGlobalKeydown(event) {
    if (event.key === 'Escape') {
      this.handleEscape();
      return;
    }

    if (event.key === 'F1') {
      event.preventDefault();
      this.toggleUtilityDocument('cheatsheet');
      return;
    }

    const hasPrimaryModifier = event.ctrlKey || event.metaKey;
    if (event.altKey && !hasPrimaryModifier && event.code === 'KeyZ') {
      event.preventDefault();
      this.toggleWordWrap();
      return;
    }

    if (!hasPrimaryModifier) {
      return;
    }

    const key = event.key.toLowerCase();
    const actions = {
      k: () => this.togglePalette(),
      o: () => this.openFile(),
      s: () => (event.shiftKey ? this.saveFileAs() : this.saveFile()),
      n: () => this.newDocument(),
      w: () => this.activeTabId !== null && this.closeTab(this.activeTabId),
      b: () => this.toggleSidebar(),
      e: () => this.cycleView(),
      f: () => this.openSearch(),
      q: () => this.quitApp(),
      y: () => this.redo(),
      z: () => (event.shiftKey ? this.redo() : this.undo()),
      tab: () => this.activateAdjacentTab(event.shiftKey ? -1 : 1),
    };

    if (!actions[key]) {
      return;
    }

    event.preventDefault();
    actions[key]();
  },
};
