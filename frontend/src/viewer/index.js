import { compose } from './compose';
import { createCore } from './core';
import { tabsPart } from './tabs';
import { utilityPart } from './utility';
import { viewPart } from './view';
import { watchPart } from './watch';
import { editingPart } from './editing';
import { filesPart } from './files';
import { scrollPart } from './scroll';
import { linksPart } from './links';
import { searchPart } from './search';
import { sessionPart } from './session';
import { palettePart } from './palette';
import { feedbackPart } from './feedback';
import { keyboardPart } from './keyboard';

// Builds the state object for x-data="markdownViewer()". UI state stays centralized in this one component.
export const createMarkdownViewer = () => compose(
  createCore(),
  tabsPart,
  utilityPart,
  viewPart,
  watchPart,
  editingPart,
  filesPart,
  scrollPart,
  linksPart,
  searchPart,
  sessionPart,
  palettePart,
  feedbackPart,
  keyboardPart,
);
