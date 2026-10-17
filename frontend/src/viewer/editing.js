// Editing and history: part of the markdownViewer Alpine component (merged in viewer/index.js).

import { countLines } from '../lib/editor';
import { renderMermaidDiagrams } from '../preview/mermaid';
import { decoratePreview, outlineFromMarkdown, renderMarkdown } from '../preview/render';

export const editingPart = {
  renderCurrentDocument() {
    this.renderNow();
  },
  scheduleRender() {
    window.clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => this.renderNow(), 80);
  },
  renderNow() {
    // exportHtml is the plain sanitized output used for "Copy rendered HTML"; the preview adds code block chrome.
    this.exportHtml = renderMarkdown(this.markdown);
    this.renderedHtml = decoratePreview(this.exportHtml, this.activeDirectory());
    this.outline = outlineFromMarkdown(this.markdown);
    this.$nextTick(() => this.refreshDiagrams());
  },
  // Draws Mermaid diagrams into the current preview DOM, then refreshes find (diagram text is searchable).
  async refreshDiagrams() {
    try {
      if (this.$refs.preview) {
        await renderMermaidDiagrams(this.$refs.preview, this.theme);
      }
    } catch (error) {
      this.statusMessage = 'Could not load the diagram renderer';
    } finally {
      if (this.isSearching) {
        this.refreshSearchResults();
      }
    }
  },
  recordHistoryForActive(nextValue) {
    const tab = this.activeTab();
    if (!tab) {
      return;
    }
    if (nextValue === tab.history[tab.historyIndex]) {
      tab.markdown = nextValue;
      this.updateDirty(tab);
      return;
    }

    tab.history = tab.history.slice(0, tab.historyIndex + 1);
    tab.history.push(nextValue);
    if (tab.history.length > this.historyLimit) {
      const overflow = tab.history.length - this.historyLimit;
      tab.history.splice(0, overflow);
    }
    tab.historyIndex = tab.history.length - 1;
    tab.markdown = nextValue;
    this.updateDirty(tab);
  },
  applyMarkdownToActive(nextValue) {
    const tab = this.activeTab();
    if (!tab) {
      return;
    }

    this.markdown = nextValue;
    this.recordHistoryForActive(nextValue);
    this.renderCurrentDocument();
  },
  undo() {
    const tab = this.activeTab();
    if (!tab || tab.historyIndex === 0) {
      this.statusMessage = 'Nothing to undo';
      return;
    }

    tab.historyIndex -= 1;
    tab.markdown = tab.history[tab.historyIndex] ?? '';
    this.markdown = tab.markdown;
    this.updateDirty(tab);
    this.renderCurrentDocument();
    this.statusMessage = 'Undo';
  },
  redo() {
    const tab = this.activeTab();
    if (!tab || tab.historyIndex >= tab.history.length - 1) {
      this.statusMessage = 'Nothing to redo';
      return;
    }

    tab.historyIndex += 1;
    tab.markdown = tab.history[tab.historyIndex] ?? '';
    this.markdown = tab.markdown;
    this.updateDirty(tab);
    this.renderCurrentDocument();
    this.statusMessage = 'Redo';
  },
  handleEditorInput(event) {
    const tab = this.activeTab();
    if (!tab || this.isUtilityTab(tab)) {
      return;
    }

    this.markdown = event.target.value;
    this.recordHistoryForActive(this.markdown);
    this.updateCursor(event);
    this.scheduleRender();
  },
  clearDocument() {
    const tab = this.activeTab();
    if (!tab || tab.kind !== 'file') {
      this.statusMessage = 'Clear is only available for file tabs';
      return;
    }

    const confirmed = window.confirm('Clear the current document? This can be undone with Undo.');
    if (!confirmed) {
      this.statusMessage = 'Clear canceled';
      return;
    }

    this.applyMarkdownToActive('');
    this.statusMessage = 'Cleared document';
  },
  wrapSelection(before, after = before, placeholder = 'text') {
    const editor = this.$refs.editor;
    if (!editor || this.isUtility) {
      return;
    }

    const { selectionStart: start, selectionEnd: end, value } = editor;
    const selected = value.slice(start, end) || placeholder;
    this.applyMarkdownToActive(value.slice(0, start) + before + selected + after + value.slice(end));
    this.$nextTick(() => {
      editor.focus();
      editor.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  },
  prefixLine(prefix) {
    const editor = this.$refs.editor;
    if (!editor || this.isUtility) {
      return;
    }

    const { selectionStart: start, value } = editor;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    this.applyMarkdownToActive(value.slice(0, lineStart) + prefix + value.slice(lineStart));
    this.$nextTick(() => {
      editor.focus();
      editor.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  },
  updateCursor(event) {
    const lines = event.target.value.slice(0, event.target.selectionStart).split('\n');
    this.cursor = { line: lines.length, col: lines[lines.length - 1].length + 1 };
  },
  get lineCount() {
    return countLines(this.markdown);
  },
  get gutterText() {
    return Array.from({ length: this.lineCount }, (_, index) => index + 1).join('\n');
  },
  get wordCount() {
    return this.markdown.split(/\s+/).filter(Boolean).length;
  },
  get readMinutes() {
    return Math.max(1, Math.round(this.wordCount / 200));
  },
};
