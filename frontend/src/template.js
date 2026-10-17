// The whole app markup; Alpine binds it to markdownViewer() (viewer/index.js).
export const appTemplate = `
  <div class="flex h-full select-none flex-col bg-bg font-sans text-fg antialiased" x-data="markdownViewer()" x-cloak @keydown.window="handleGlobalKeydown($event)">

    <header class="flex h-12 shrink-0 items-center gap-1.5 border-b border-line bg-surface px-2">
      <button type="button" class="icon-btn" title="Toggle sidebar (Ctrl B)" @click="toggleSidebar()">
        <i :class="sidebarOpen ? 'ri-side-bar-fill' : 'ri-side-bar-line'"></i>
      </button>

      <div class="mr-1 flex shrink-0 items-center gap-2 pl-1 pr-2">
        <div class="grid size-7 place-items-center rounded-lg bg-linear-to-br from-cyan-400 to-teal-500 text-[15px] text-slate-950 shadow-[0_0_18px_-4px_rgb(34_211_238/0.6)]">
          <i class="ri-markdown-fill"></i>
        </div>
        <span class="hidden text-[14px] font-semibold tracking-tight sm:inline">mdit</span>
      </div>

      <nav class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]" role="tablist">
        <template x-for="tab in tabs" :key="tab.id">
          <div
            role="tab"
            class="doc-tab group"
            :class="tab.id === activeTabId && 'doc-tab-active'"
            :aria-selected="tab.id === activeTabId"
            :title="tabTooltip(tab)"
            @click="setActiveTab(tab.id)"
            @auxclick.prevent="$event.button === 1 && closeTab(tab.id)"
          >
            <i :class="[tabIcon(tab), isUtilityTab(tab) ? 'text-violet-400' : 'text-accent']"></i>
            <span class="max-w-40 truncate" x-text="tab.title"></span>
            <button type="button" class="relative grid size-5 place-items-center rounded-md hover:bg-fg/10" title="Close tab (Ctrl W)" @click.stop="closeTab(tab.id)">
              <span class="size-2 rounded-full bg-amber-400" :class="tab.isDirty ? 'block group-hover:hidden' : 'hidden'"></span>
              <i class="ri-close-line text-[14px]" :class="tab.isDirty ? 'hidden group-hover:block' : (tab.id === activeTabId ? 'block' : 'block opacity-0 group-hover:opacity-100')"></i>
            </button>
          </div>
        </template>
        <button type="button" class="icon-btn-sm" title="New document (Ctrl N)" @click="newDocument()"><i class="ri-add-line"></i></button>
      </nav>

      <button
        type="button"
        class="hidden h-8 w-72 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-bg/60 px-2.5 text-[13px] text-muted transition hover:border-accent/40 hover:text-fg lg:flex"
        @click="openPalette()"
      >
        <i class="ri-search-line"></i>
        <span class="flex-1 truncate text-left">Search or run a command</span>
        <span class="kbd">Ctrl K</span>
      </button>
      <button type="button" class="icon-btn lg:hidden" title="Command palette (Ctrl K)" @click="openPalette()"><i class="ri-command-line"></i></button>

      <div
        class="hidden shrink-0 items-center rounded-lg bg-bg/60 p-0.5 ring-1 ring-line sm:flex"
        role="radiogroup"
        aria-label="View mode"
        :title="isUtility ? 'Read-only documents have no source view. Use “Edit a copy” to change it.' : 'Switch view (Ctrl E)'"
      >
        <template x-for="mode in viewModes" :key="mode.id">
          <button
            type="button"
            class="flex h-7 min-w-8 items-center justify-center gap-1.5 rounded-md px-2 text-[15px] transition disabled:cursor-not-allowed disabled:opacity-40"
            :class="view === mode.id && !isUtility ? 'bg-elevated text-accent shadow-sm' : 'text-muted hover:text-fg'"
            :title="isUtility ? '' : mode.label"
            :aria-checked="view === mode.id"
            :disabled="isUtility"
            @click="setView(mode.id)"
          >
            <i :class="mode.icon"></i>
            <span class="hidden text-[12.5px] font-medium xl:inline" x-text="mode.label"></span>
          </button>
        </template>
      </div>

      <button type="button" class="icon-btn" :title="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'" @click="toggleTheme()">
        <i :class="theme === 'dark' ? 'ri-sun-line' : 'ri-moon-clear-line'"></i>
      </button>
    </header>

    <div class="relative flex min-h-0 flex-1">
      <div x-show="sidebarOpen" x-transition.opacity class="absolute inset-0 z-20 bg-slate-950/40 lg:hidden" @click="sidebarOpen = false"></div>
      <aside
        x-show="sidebarOpen"
        x-transition:enter="transition duration-150 ease-out"
        x-transition:enter-start="-translate-x-4 opacity-0"
        x-transition:leave="transition duration-100 ease-in"
        x-transition:leave-end="-translate-x-4 opacity-0"
        class="flex w-64 shrink-0 flex-col border-r border-line bg-surface max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-30 max-lg:shadow-2xl"
      >
        <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          <div class="section-label flex items-center justify-between">
            <span>Open documents</span>
            <span class="rounded-full bg-elevated px-1.5 text-[10px] font-medium normal-case tracking-normal" x-text="tabs.length"></span>
          </div>
          <template x-for="tab in tabs" :key="'side-' + tab.id">
            <button type="button" class="side-item" :class="tab.id === activeTabId && 'side-item-active'" :title="tabTooltip(tab)" @click="activateFromSidebar(tab.id)">
              <i class="text-[15px]" :class="[tabIcon(tab), isUtilityTab(tab) ? 'text-violet-400' : 'text-accent']"></i>
              <span class="min-w-0 flex-1 truncate" x-text="tab.title"></span>
              <span x-show="tab.isDirty" class="size-1.5 rounded-full bg-amber-400" title="Unsaved changes"></span>
            </button>
          </template>

          <div class="section-label">Outline</div>
          <template x-for="(item, index) in outline" :key="activeTabId + '-' + index">
            <button
              type="button"
              class="side-item py-1!"
              :style="'padding-left: ' + (0.75 + (item.depth - 1) * 0.85) + 'rem'"
              :title="'Line ' + item.line"
              @click="jumpToHeading(index)"
            >
              <span class="text-[10px] font-semibold text-muted/60" x-text="'H' + item.depth"></span>
              <span class="min-w-0 flex-1 truncate" :class="item.depth === 1 && 'font-medium text-fg'" x-text="item.text"></span>
            </button>
          </template>
          <p x-show="outline.length === 0" class="px-3 text-[12px] text-muted">No headings yet.</p>
        </div>

        <div class="m-2 rounded-xl border border-line bg-elevated/60 p-3 text-[12px] leading-relaxed text-muted">
          <div class="mb-1 flex items-center gap-1.5 font-medium text-fg"><i class="ri-lightbulb-flash-line text-accent"></i> Tip</div>
          Press <span class="kbd">Ctrl K</span> to search commands, open files and switch views.
        </div>
      </aside>

      <main class="flex min-w-0 flex-1 flex-col">
        <div class="flex h-11 shrink-0 items-center gap-2 px-4">
          <div class="flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
            <template x-if="activeDirectory()">
              <span class="flex min-w-0 items-center gap-1.5" :title="activeTab()?.filePath">
                <i class="ri-folder-3-line"></i>
                <span class="truncate [direction:rtl]"><bdi x-text="activeDirectory()"></bdi></span>
                <i class="ri-arrow-right-s-line text-muted/60"></i>
              </span>
            </template>
            <span class="max-w-72 shrink-0 truncate font-medium text-fg" x-text="activeTab()?.title"></span>
          </div>
          <span
            x-show="!isUtility"
            class="chip"
            :class="activeTab()?.isDirty ? 'bg-amber-400/12 text-amber-500' : 'bg-emerald-400/12 text-emerald-500'"
          >
            <i :class="activeTab()?.isDirty ? 'ri-edit-circle-line' : 'ri-checkbox-circle-line'"></i>
            <span x-text="activeTab()?.isDirty ? 'Edited' : 'Saved'"></span>
          </span>
          <span x-show="isUtility" class="chip bg-violet-400/12 text-violet-400">Read-only</span>

          <div class="ml-auto flex items-center gap-1.5">
            <button type="button" class="action-btn" title="Undo (Ctrl Z)" :disabled="isUtility" @click="undo()">
              <i class="ri-arrow-go-back-line"></i><span class="hidden lg:inline">Undo</span>
            </button>
            <button type="button" class="action-btn" title="Redo (Ctrl Y)" :disabled="isUtility" @click="redo()">
              <i class="ri-arrow-go-forward-line"></i><span class="hidden lg:inline">Redo</span>
            </button>
            <button type="button" class="action-btn" title="Find in preview (Ctrl F)" @click="openSearch()">
              <i class="ri-search-line"></i><span class="hidden lg:inline">Find</span>
            </button>
            <button type="button" class="action-btn" title="Open file (Ctrl O)" @click="openFile()">
              <i class="ri-folder-open-line"></i><span class="hidden lg:inline">Open</span>
            </button>
            <button
              type="button"
              class="action-btn"
              :class="activeTab()?.isDirty && 'action-btn-primary'"
              title="Save (Ctrl S)"
              :disabled="isUtility"
              @click="saveFile()"
            >
              <i class="ri-save-3-line"></i><span class="hidden lg:inline">Save</span>
            </button>
          </div>
        </div>

        <div class="relative flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 md:flex-row">
          <div
            x-show="isSearching"
            x-transition
            class="absolute right-6 top-14 z-10 flex items-center gap-1 rounded-xl border border-line bg-surface/95 p-1 pl-3 shadow-xl backdrop-blur"
          >
            <i class="ri-search-line text-muted"></i>
            <input
              type="text"
              x-ref="searchInput"
              x-model="searchQuery"
              class="w-40 bg-transparent px-1 text-[13px] outline-hidden placeholder:text-muted/70 sm:w-52"
              placeholder="Find in preview"
              @input.debounce.150ms="performSearch()"
              @keydown.enter.prevent="$event.shiftKey ? prevMatch() : nextMatch()"
            />
            <span class="min-w-14 text-right text-[11px] tabular-nums text-muted" x-text="searchQuery.trim() ? (searchResultsCount ? (searchIndex + 1) + ' / ' + searchResultsCount : 'No results') : ''"></span>
            <button type="button" class="icon-btn-sm" title="Previous match (Shift Enter)" @click="prevMatch()"><i class="ri-arrow-up-s-line"></i></button>
            <button type="button" class="icon-btn-sm" title="Next match (Enter)" @click="nextMatch()"><i class="ri-arrow-down-s-line"></i></button>
            <button type="button" class="icon-btn-sm" title="Close (Esc)" @click="clearSearch()"><i class="ri-close-line"></i></button>
          </div>

          <section x-show="showEditor" class="pane">
            <div class="pane-head">
              <span class="pane-title">Markdown</span>
              <button type="button" x-show="view === 'editor'" class="pane-toggle" title="Show preview (Ctrl E)" @click="setView('split')">
                <i class="ri-eye-line"></i> Show preview
              </button>
              <div class="ml-auto flex items-center gap-0.5">
                <button type="button" class="icon-btn-sm" title="Heading" @click="prefixLine('## ')"><i class="ri-heading"></i></button>
                <button type="button" class="icon-btn-sm" title="Bold" @click="wrapSelection('**')"><i class="ri-bold"></i></button>
                <button type="button" class="icon-btn-sm" title="Italic" @click="wrapSelection('*')"><i class="ri-italic"></i></button>
                <span class="mx-1 h-4 w-px bg-line"></span>
                <button type="button" class="icon-btn-sm" title="Link" @click="wrapSelection('[', '](https://)', 'link')"><i class="ri-link"></i></button>
                <button type="button" class="icon-btn-sm" title="Inline code" @click="wrapSelection('\`', '\`', 'code')"><i class="ri-code-line"></i></button>
                <button type="button" class="icon-btn-sm hidden sm:grid" title="Quote" @click="prefixLine('> ')"><i class="ri-double-quotes-l"></i></button>
                <button type="button" class="icon-btn-sm hidden sm:grid" title="Task" @click="prefixLine('- [ ] ')"><i class="ri-checkbox-line"></i></button>
                <span class="mx-1 h-4 w-px bg-line"></span>
                <button type="button" class="icon-btn-sm" :class="wordWrap && 'bg-accent/10 text-accent!'" title="Word wrap (Alt Z)" @click="toggleWordWrap()"><i class="ri-text-wrap"></i></button>
              </div>
            </div>
            <div class="flex min-h-0 flex-1">
              <div x-show="!wordWrap" x-ref="gutter" class="w-12 shrink-0 select-none overflow-hidden pb-[75vh] pl-2 pr-3 pt-4 text-right font-mono text-[12px] leading-6 text-gutter" aria-hidden="true">
                <div class="relative">
                  <div class="whitespace-pre" x-text="gutterText"></div>
                  <div class="absolute inset-x-0 bg-surface text-accent" :style="'top: ' + (cursor.line - 1) * 1.5 + 'rem'" x-text="cursor.line"></div>
                </div>
              </div>
              <label class="sr-only" for="editor">Markdown editor</label>
              <textarea
                id="editor"
                x-ref="editor"
                x-model="markdown"
                :wrap="wordWrap ? 'soft' : 'off'"
                spellcheck="false"
                class="min-h-0 flex-1 resize-none select-text bg-transparent pb-[75vh] pr-4 pt-4 font-mono text-[13px] leading-6 text-fg caret-accent outline-hidden selection:bg-accent/25 placeholder:text-muted/60"
                :class="wordWrap ? 'pl-4' : 'pl-1'"
                placeholder="# Start writing…"
                :readonly="isUtility"
                @input="handleEditorInput($event)"
                @scroll="handleSourceScroll($event)"
                @keyup="updateCursor($event)"
                @click="updateCursor($event)"
              ></textarea>
            </div>
          </section>

          <section x-show="showPreview" class="pane">
            <div class="pane-head">
              <span class="pane-title">Preview</span>
              <button type="button" x-show="view === 'preview' && !isUtility" class="pane-toggle" title="Show source (Ctrl E)" @click="setView('split')">
                <i class="ri-code-s-slash-line"></i> Show source
              </button>
              <button type="button" x-show="isUtility" class="pane-toggle" title="Open an editable copy as a new document" @click="editUtilityCopy()">
                <i class="ri-file-copy-2-line"></i> Edit a copy
              </button>
              <span class="ml-auto text-[12px] text-muted" x-text="readMinutes + ' min read'"></span>
            </div>
            <div id="preview-scroller" x-ref="previewScroller" class="min-h-0 flex-1 overflow-y-auto" @scroll="handlePreviewScroll($event)">
              <article
                id="preview"
                x-ref="preview"
                class="markdown-preview mx-auto max-w-3xl px-6 pb-[75vh] pt-8 sm:px-10"
                x-html="renderedHtml"
                @click="handlePreviewClick($event)"
              ></article>
            </div>
          </section>
        </div>
      </main>
    </div>

    <footer class="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-surface px-3 text-[11.5px] text-muted">
      <span class="flex shrink-0 items-center gap-1.5">
        <span class="size-1.5 rounded-full" :class="activeTab()?.isDirty ? 'bg-amber-400' : 'bg-emerald-400'"></span>
        <span x-text="isUtility ? 'Read-only document' : (activeTab()?.isDirty ? 'Unsaved changes' : 'All changes saved')"></span>
      </span>
      <span class="hidden min-w-0 truncate text-muted/80 md:inline" x-text="statusMessage"></span>
      <span class="ml-auto shrink-0 tabular-nums" x-show="showEditor" x-text="'Ln ' + cursor.line + ', Col ' + cursor.col"></span>
      <span class="shrink-0 tabular-nums" x-text="wordCount + ' words'"></span>
      <span class="hidden shrink-0 sm:inline">UTF-8</span>
      <span class="hidden shrink-0 items-center gap-1 sm:flex"><i class="ri-markdown-line"></i> Markdown</span>
    </footer>

    <div
      x-show="paletteOpen"
      x-transition.opacity.duration.150ms
      class="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 px-4 pt-[12vh] backdrop-blur-sm"
      @click.self="paletteOpen = false"
    >
      <div class="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl" role="dialog" aria-label="Command palette">
        <div class="flex items-center gap-3 border-b border-line px-4">
          <i class="ri-command-line text-lg text-accent"></i>
          <input
            type="text"
            x-ref="paletteInput"
            x-model="paletteQuery"
            class="h-13 flex-1 bg-transparent text-[15px] outline-hidden placeholder:text-muted/70"
            placeholder="Type a command…"
            @input="paletteIndex = 0"
            @keydown.arrow-down.prevent="movePalette(1)"
            @keydown.arrow-up.prevent="movePalette(-1)"
            @keydown.enter.prevent="runCommand(filteredCommands[paletteIndex])"
          />
          <span class="kbd">Esc</span>
        </div>
        <ul x-ref="paletteList" class="max-h-80 scroll-py-1.5 overflow-y-auto p-1.5">
          <template x-for="(command, index) in filteredCommands" :key="command.id">
            <li>
              <button
                type="button"
                class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13.5px]"
                :class="index === paletteIndex ? 'bg-accent/12 text-fg' : 'text-muted'"
                :data-index="index"
                @mousemove="hoverCommand($event, index)"
                @click="runCommand(command)"
              >
                <i class="text-[16px]" :class="[command.icon, index === paletteIndex && 'text-accent']"></i>
                <span class="flex-1" x-text="command.label"></span>
                <span x-show="command.keys" class="kbd" x-text="command.keys"></span>
              </button>
            </li>
          </template>
          <li x-show="filteredCommands.length === 0" class="px-3 py-6 text-center text-[13px] text-muted">No matching commands</li>
        </ul>
        <div class="flex items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-muted">
          <span><span class="kbd">↑</span> <span class="kbd">↓</span> navigate</span>
          <span><span class="kbd">↵</span> run</span>
          <span><span class="kbd">Esc</span> close</span>
        </div>
      </div>
    </div>

    <div
      x-show="toast"
      x-transition
      class="fixed bottom-10 right-4 z-50 flex items-center gap-2 rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-[13px] shadow-2xl"
    >
      <i class="ri-information-line text-accent"></i>
      <span x-text="toast"></span>
    </div>
  </div>
`;
