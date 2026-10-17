// Scroll sync and outline navigation: part of the markdownViewer Alpine component (merged in viewer/index.js).

import { measureOffsetTop } from '../lib/editor';

export const scrollPart = {
  syncPaneScroll(fromElement, toElement, origin) {
    if (!fromElement || !toElement) {
      return;
    }
    if (this.syncOrigin && this.syncOrigin !== origin) {
      return;
    }

    const fromMax = fromElement.scrollHeight - fromElement.clientHeight;
    const toMax = toElement.scrollHeight - toElement.clientHeight;

    if (toMax <= 0) {
      return;
    }

    const ratio = fromMax > 0 ? fromElement.scrollTop / fromMax : 0;
    const targetTop = Math.round(ratio * toMax);

    if (Math.abs(toElement.scrollTop - targetTop) < 1) {
      return;
    }

    this.syncOrigin = origin;
    toElement.scrollTop = targetTop;
    this.releaseScrollSync(50);
  },
  releaseScrollSync(delay) {
    window.clearTimeout(this.syncReleaseTimer);
    this.syncReleaseTimer = window.setTimeout(() => {
      this.syncOrigin = null;
      this.syncReleaseTimer = null;
    }, delay);
  },
  handleSourceScroll(event) {
    if (this.$refs.gutter) {
      this.$refs.gutter.scrollTop = event.target.scrollTop;
    }
    if (!this.showEditor || !this.showPreview) {
      return;
    }

    this.syncPaneScroll(event.target, this.$refs.previewScroller, 'source');
  },
  handlePreviewScroll(event) {
    if (!this.showEditor || !this.showPreview) {
      return;
    }

    this.syncPaneScroll(event.target, this.$refs.editor, 'preview');
  },
  jumpToHeading(index) {
    const item = this.outline[index];
    if (!item) {
      return;
    }

    // Hold proportional sync while both panes jump, or one pane would drag the other off target.
    this.syncOrigin = 'outline';
    this.releaseScrollSync(1000);

    if (this.showPreview) {
      const headings = this.$refs.preview?.querySelectorAll(':scope > h1, :scope > h2, :scope > h3');
      headings?.[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    this.revealEditorLine(item.line);
    this.closeSidebarOnNarrowScreens();
  },
  revealEditorLine(line) {
    const editor = this.$refs.editor;
    if (!editor || !this.showEditor) {
      return;
    }

    const lines = editor.value.split('\n');
    const offset = lines.slice(0, line - 1).join('\n').length + (line > 1 ? 1 : 0);
    editor.focus({ preventScroll: true });
    editor.setSelectionRange(offset, offset);
    this.cursor = { line, col: 1 };

    const lineHeight = parseFloat(window.getComputedStyle(editor).lineHeight) || 24;
    const top = measureOffsetTop(editor, offset);
    editor.scrollTo({ top: Math.max(0, top - lineHeight * 2), behavior: 'smooth' });
  },
};
