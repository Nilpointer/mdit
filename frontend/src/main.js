import './style.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import 'katex/dist/katex.min.css';

import Alpine from 'alpinejs';
import 'remixicon/fonts/remixicon.css';

import { appTemplate } from './template';
import { createMarkdownViewer } from './viewer';

window.markdownViewer = createMarkdownViewer;

document.querySelector('#app').innerHTML = appTemplate;

window.Alpine = Alpine;
Alpine.start();
