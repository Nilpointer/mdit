// Find in preview: part of the markdownViewer Alpine component (merged in viewer/index.js).

export const searchPart = {
  openSearch() {
    this.isSearching = true;
    this.$nextTick(() => {
      this.$refs.searchInput?.focus();
      this.$refs.searchInput?.select();
      this.refreshSearchResults();
    });
  },
  toggleSearch() {
    if (this.isSearching) {
      this.clearSearch();
      return;
    }

    this.openSearch();
  },
  performSearch() {
    this.searchIndex = 0;
    this.refreshSearchResults({ scrollToCurrent: true });
  },
  refreshSearchResults({ scrollToCurrent = false } = {}) {
    const highlights = window.CSS?.highlights;
    highlights?.delete('search');
    highlights?.delete('search-current');

    const preview = this.$refs.preview;
    const query = this.searchQuery.trim().toLowerCase();
    if (!this.isSearching || !query || !preview) {
      this.searchResultsCount = 0;
      this.searchIndex = -1;
      return;
    }

    const ranges = [];
    // Skip text the user cannot see: style rules inside Mermaid SVGs and KaTeX's hidden MathML/TeX copy.
    const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (node.parentElement?.closest('style, .katex-mathml') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent.toLowerCase();
      for (let index = text.indexOf(query); index !== -1; index = text.indexOf(query, index + query.length)) {
        const range = new Range();
        range.setStart(node, index);
        range.setEnd(node, index + query.length);
        ranges.push(range);
      }
    }

    this.searchResultsCount = ranges.length;
    if (ranges.length === 0) {
      this.searchIndex = -1;
      this.statusMessage = 'No matches found';
      return;
    }

    this.searchIndex = Math.min(Math.max(this.searchIndex, 0), ranges.length - 1);
    const current = ranges[this.searchIndex];
    if (highlights && window.Highlight) {
      highlights.set('search', new Highlight(...ranges));
      highlights.set('search-current', new Highlight(current));
    }
    this.statusMessage = `Match ${this.searchIndex + 1} of ${this.searchResultsCount}`;

    if (scrollToCurrent) {
      current.startContainer.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  },
  stepMatch(direction) {
    if (this.searchResultsCount === 0) {
      return;
    }

    this.searchIndex = (this.searchIndex + direction + this.searchResultsCount) % this.searchResultsCount;
    this.refreshSearchResults({ scrollToCurrent: true });
  },
  nextMatch() {
    this.stepMatch(1);
  },
  prevMatch() {
    this.stepMatch(-1);
  },
  clearSearch() {
    this.searchQuery = '';
    this.searchIndex = -1;
    this.searchResultsCount = 0;
    this.isSearching = false;
    this.refreshSearchResults();
    this.statusMessage = 'Search cleared';
  },
};
