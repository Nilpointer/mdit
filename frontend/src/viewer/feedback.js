// Feedback: part of the markdownViewer Alpine component (merged in viewer/index.js).

export const feedbackPart = {
  notify(message) {
    this.statusMessage = message;
    this.toast = message;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toast = '';
    }, 2200);
  },
};
