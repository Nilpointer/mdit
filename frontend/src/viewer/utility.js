// Utility documents (cheat sheet, about): part of the markdownViewer Alpine component (merged in viewer/index.js).

import { utilityDocs } from './constants';

export const utilityPart = {
  isUtilityTab(tab) {
    return tab?.kind === 'cheatsheet' || tab?.kind === 'about';
  },
  get isUtility() {
    return this.isUtilityTab(this.activeTab());
  },
  openUtilityDocumentAsTab(kind) {
    const { title, content } = utilityDocs[kind];
    const existing = this.tabs.find((tab) => tab.kind === kind);
    if (existing) {
      this.setActiveTab(existing.id);
      this.statusMessage = `${title} tab focused`;
      return;
    }

    this.createTab({ markdown: content, title, kind, isDirty: false, focus: true });
    this.statusMessage = `${title} opened`;
  },
  toggleUtilityDocument(kind) {
    if (this.activeTab()?.kind !== kind) {
      this.openUtilityDocumentAsTab(kind);
      return;
    }

    this.closeTab(this.activeTabId);
    this.statusMessage = `${utilityDocs[kind].title} closed`;
  },
  editUtilityCopy() {
    const source = this.activeTab();
    if (!this.isUtilityTab(source)) {
      return;
    }

    this.createTab({ markdown: source.markdown, title: `${source.kind}-copy.md`, kind: 'file', isDirty: true });
    this.view = 'split';
    this.statusMessage = 'Opened an editable copy';
  },
};
