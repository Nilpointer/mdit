// Command palette: part of the markdownViewer Alpine component (merged in viewer/index.js).

export const palettePart = {
  get commands() {
    const kind = this.activeTab()?.kind;
    return [
      { id: 'new', label: 'New document', icon: 'ri-file-add-line', keys: 'Ctrl N', run: () => this.newDocument() },
      { id: 'open', label: 'Open file…', icon: 'ri-folder-open-line', keys: 'Ctrl O', run: () => this.openFile() },
      { id: 'save', label: 'Save', icon: 'ri-save-3-line', keys: 'Ctrl S', run: () => this.saveFile() },
      { id: 'save-as', label: 'Save As…', icon: 'ri-save-line', keys: 'Ctrl Shift S', run: () => this.saveFileAs() },
      ...this.recentCommands,
      { id: 'undo', label: 'Undo', icon: 'ri-arrow-go-back-line', keys: 'Ctrl Z', run: () => this.undo() },
      { id: 'redo', label: 'Redo', icon: 'ri-arrow-go-forward-line', keys: 'Ctrl Y', run: () => this.redo() },
      { id: 'find', label: 'Find in preview', icon: 'ri-search-line', keys: 'Ctrl F', run: () => this.openSearch() },
      { id: 'clear', label: 'Clear document', icon: 'ri-eraser-line', keys: '', run: () => this.clearDocument() },
      { id: 'sidebar', label: 'Toggle sidebar', icon: 'ri-side-bar-line', keys: 'Ctrl B', run: () => this.toggleSidebar() },
      { id: 'cycle-view', label: 'Cycle view mode', icon: 'ri-loop-right-line', keys: 'Ctrl E', run: () => this.cycleView() },
      { id: 'view-editor', label: 'View: Editor only', icon: 'ri-code-s-slash-line', keys: '', run: () => this.setView('editor') },
      { id: 'view-split', label: 'View: Split', icon: 'ri-layout-column-line', keys: '', run: () => this.setView('split') },
      { id: 'view-preview', label: 'View: Preview only', icon: 'ri-eye-line', keys: '', run: () => this.setView('preview') },
      { id: 'wrap', label: this.wordWrap ? 'Disable word wrap' : 'Enable word wrap', icon: 'ri-text-wrap', keys: 'Alt Z', run: () => this.toggleWordWrap() },
      { id: 'theme', label: this.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme', icon: 'ri-contrast-2-line', keys: '', run: () => this.toggleTheme() },
      { id: 'copy-html', label: 'Copy rendered HTML', icon: 'ri-file-copy-line', keys: '', run: () => this.copyRenderedHtml() },
      { id: 'close-tab', label: 'Close tab', icon: 'ri-close-line', keys: 'Ctrl W', run: () => this.closeTab(this.activeTabId) },
      { id: 'close-all', label: 'Close all tabs', icon: 'ri-close-circle-line', keys: '', run: () => this.closeAllTabs() },
      ...(this.recentFiles.length > 0 ? [{ id: 'clear-recent', label: 'Clear recent files', icon: 'ri-delete-bin-line', keys: '', run: () => this.clearRecentFiles() }] : []),
      { id: 'cheatsheet', label: kind === 'cheatsheet' ? 'Close cheat sheet' : 'Markdown cheat sheet', icon: 'ri-book-2-line', keys: 'F1', run: () => this.toggleUtilityDocument('cheatsheet') },
      { id: 'about', label: kind === 'about' ? 'Close about' : 'About mdit', icon: 'ri-information-line', keys: '', run: () => this.toggleUtilityDocument('about') },
      { id: 'quit', label: 'Quit mdit', icon: 'ri-shut-down-line', keys: 'Ctrl Q', run: () => this.quitApp() },
    ];
  },
  get filteredCommands() {
    const query = this.paletteQuery.trim().toLowerCase();
    if (!query) {
      return this.commands;
    }
    return this.commands.filter((command) => command.label.toLowerCase().includes(query));
  },
  openPalette() {
    this.paletteOpen = true;
    this.paletteQuery = '';
    this.paletteIndex = 0;
    this.$nextTick(() => {
      this.$refs.paletteInput?.focus();
      if (this.$refs.paletteList) {
        this.$refs.paletteList.scrollTop = 0;
      }
    });
  },
  togglePalette() {
    if (this.paletteOpen) {
      this.paletteOpen = false;
      return;
    }

    this.openPalette();
  },
  movePalette(step) {
    const count = this.filteredCommands.length;
    if (count === 0) {
      return;
    }

    this.paletteIndex = (this.paletteIndex + step + count) % count;
    this.$nextTick(() => {
      this.$refs.paletteList?.querySelector(`[data-index="${this.paletteIndex}"]`)?.scrollIntoView({ block: 'nearest' });
    });
  },
  hoverCommand(event, index) {
    // Browsers fire synthetic mousemove when the list scrolls under a resting pointer; only follow real movement.
    const point = `${event.screenX},${event.screenY}`;
    if (point === this.palettePointer) {
      return;
    }

    this.palettePointer = point;
    this.paletteIndex = index;
  },
  runCommand(command) {
    if (!command) {
      return;
    }

    this.paletteOpen = false;
    command.run();
  },
};
