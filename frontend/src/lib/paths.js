// Path helpers shared by tabs, the preview and file handling.

export const filenameFromPath = (path) => {
  if (!path) {
    return 'untitled.md';
  }
  const segments = path.split(/[\\/]/);
  return segments[segments.length - 1] || 'untitled.md';
};

export const directoryFromPath = (path) => {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return index > 0 ? path.slice(0, index) : '';
};

// Same extensions as isMarkdownPath in Go (CLI arguments and OS file opens).
export const isMarkdownPath = (path) => /\.(md|markdown)$/i.test(path);

export const isAbsoluteLocalPath =(path) => path.startsWith('/') || path.startsWith('\\\\') || /^[a-z]:[\\/]/i.test(path);
