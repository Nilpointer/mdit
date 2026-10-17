// Preview links: part of the markdownViewer Alpine component (merged in viewer/index.js).

import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';
import { utilityDocs } from './constants';

export const linksPart = {
  handlePreviewClick(event) {
    const copyButton = event.target.closest('[data-copy-code]');
    if (copyButton) {
      this.copyCodeBlock(copyButton);
      return;
    }

    const link = event.target.closest('a');
    if (!link) {
      return;
    }

    event.preventDefault();
    const href = link.getAttribute('href');
    if (!href) {
      return;
    }

    const tab = this.activeTab();
    if (this.isUtilityTab(tab) && href === utilityDocs[tab.kind].closeHref) {
      this.toggleUtilityDocument(tab.kind);
      return;
    }

    try {
      BrowserOpenURL(href);
    } catch {
      this.notify('Could not open link in browser');
    }
  },
};
