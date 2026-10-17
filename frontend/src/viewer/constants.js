import cheatSheetMarkdown from '../assets/markdown/cheatsheet.md?raw';
import aboutMarkdown from '../assets/markdown/about.md?raw';

export const initialMarkdown = `# mdit Markdown Viewer

Welcome to your Wails markdown editor.

## Features

- Live preview while you type
- Command palette: press \`Ctrl K\`
- Outline of your headings in the sidebar

### Example Code

\`\`\`go
func hello(name string) string {
    return "Hello " + name
}
\`\`\`

> Tip: Click links in preview to open them in your default browser.

[Wails Documentation](https://wails.io/docs/)
`;

export const backendApp = () => window.go?.main?.App;

export const utilityDocs = {
  cheatsheet: { title: 'Markdown Cheat Sheet', content: cheatSheetMarkdown, icon: 'ri-book-2-line', closeHref: '#close-cheatsheet' },
  about: { title: 'About mdit', content: aboutMarkdown, icon: 'ri-information-line', closeHref: '#close-about' },
};

export const viewModes = [
  { id: 'editor', icon: 'ri-code-s-slash-line', label: 'Editor' },
  { id: 'split', icon: 'ri-layout-column-line', label: 'Split' },
  { id: 'preview', icon: 'ri-eye-line', label: 'Preview' },
];
