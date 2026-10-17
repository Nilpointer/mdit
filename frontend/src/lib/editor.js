// Measuring helpers for the source textarea.

export const countLines = (text) => {
  let count = 1;
  for (let index = text.indexOf('\n'); index !== -1; index = text.indexOf('\n', index + 1)) {
    count += 1;
  }
  return count;
};

// Pixel offset of a character inside a textarea, measured with a hidden mirror so wrapped lines count.
export const measureOffsetTop = (textarea, offset) => {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement('div');
  for (const prop of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'tabSize', 'paddingTop', 'paddingLeft', 'paddingRight']) {
    mirror.style[prop] = style[prop];
  }
  Object.assign(mirror.style, {
    position: 'absolute',
    visibility: 'hidden',
    top: '0',
    left: '-9999px',
    boxSizing: 'border-box',
    width: `${textarea.clientWidth}px`,
    whiteSpace: textarea.getAttribute('wrap') === 'off' ? 'pre' : 'pre-wrap',
    overflowWrap: 'break-word',
  });
  mirror.textContent = textarea.value.slice(0, offset);
  document.body.append(mirror);
  const top = mirror.scrollHeight;
  mirror.remove();
  return top;
};
