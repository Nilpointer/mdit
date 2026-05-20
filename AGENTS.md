# AGENTS.md

Repository guidance for agentic coding in `mdit`.

## Project Shape

- Go + Wails desktop app.
- Backend entrypoints: `main.go` and `app.go`.
- Frontend lives in `frontend/` and is bundled into `frontend/dist`.
- The app embeds `frontend/dist` at Go build time via `//go:embed`.
- Generated Wails bindings live under `frontend/wailsjs/`; do not hand-edit them unless you are regenerating.
- No Cursor rules or Copilot instructions were found in `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md`.

## Source of Truth

- `README.md` explains the app and user-facing workflows.
- `Makefile` is the quickest way to run common tasks.
- `go.mod` pins Go 1.23.
- `frontend/package.json` defines the frontend build scripts.

## Common Commands

- Dev mode: `make dev`
- Production build: `make build`
- Frontend-only build: `make frontend-build`
- Clean build artifacts: `make clean`
- Direct Wails dev: `wails dev`
- Direct Wails build: `wails build`
- Linux WebKit build: `wails build -clean -tags webkit2_41`
- Frontend preview: `npm --prefix frontend run preview`

## Go Tooling

- Preferred Go toolchain in this repo: `mise exec go@1.23.12 -- ...`
- Format Go files: `mise exec go@1.23.12 -- gofmt -w <files>`
- Run all Go tests: `mise exec go@1.23.12 -- go test ./...`
- Run one package: `mise exec go@1.23.12 -- go test ./path/to/package`
- Run one test function in all packages: `mise exec go@1.23.12 -- go test ./... -run '^TestName$'`
- Run one test function in one package: `mise exec go@1.23.12 -- go test ./somepkg -run '^TestName$'`
- Run verbose tests: `mise exec go@1.23.12 -- go test -v ./...`
- Build the desktop app: `mise exec go@1.23.12 -- wails build`

## Frontend Tooling

- Install/update frontend deps: `npm --prefix frontend install`
- Build frontend assets: `npm --prefix frontend run build`
- Run Vite dev server: `npm --prefix frontend run dev`
- Use `npm --prefix frontend ...` instead of `cd frontend && ...`.

## Verification Expectations

- Run `gofmt` on every touched Go file.
- Run `mise exec go@1.23.12 -- go test ./...` after backend changes.
- Run `npm --prefix frontend run build` after frontend changes.
- Run `mise exec go@1.23.12 -- wails build` when the packaged app or embedded assets change.
- Manually check file open/save, cancel, and preview behavior when file handling changes.

## Go Style

- Use standard Go formatting and import grouping.
- Keep imports minimal; remove unused imports immediately.
- Prefer small files and small methods.
- Return early on invalid state, missing context, or canceled dialogs.
- Prefer explicit error returns over panics.
- Wrap errors only when the added context is useful to the caller.
- Use zero values and simple structs over heavy constructors unless needed.
- Keep package-level names short when the package is `main`.

## Go Naming

- Exported names use `CamelCase`.
- Unexported names use `camelCase`.
- Acronyms should stay consistent: `ctx`, `ID`, `URL`.
- Backend structs should be noun-based: `App`, `FilePayload`.
- Methods and handlers should be verb phrases: `OpenFile`, `SaveFile`, `toggleMenu`.

## Backend Patterns

- `App` stores the Wails `context.Context` after startup.
- Wails runtime dialogs are the source of truth for native file open/save flows.
- `OpenFile` may return `nil, nil` when the user cancels.
- `SaveFile` appends `.md` when the chosen path has no extension.
- Keep file-dialog filters and save-extension behavior stable unless a task explicitly changes them.
- Use `0o644` for text file writes unless there is a strong reason not to.

## Frontend Style

- Frontend JS uses modern ESM syntax.
- Semicolons are not used in frontend JS.
- Prefer `const`; use `let` only when reassignment is required.
- Use single quotes for JS strings.
- Keep Alpine methods small, descriptive, and focused.
- Avoid global side effects except for bootstrap wiring and Wails bridge setup.
- Keep UI state centralized in `window.markdownViewer`.
- Use guard clauses for missing elements, canceled dialogs, and unavailable bridge APIs.

## Markdown and Preview Safety

- Render Markdown with `marked`.
- Sanitize rendered HTML with `DOMPurify` before injecting it.
- Do not introduce raw unsanitized `innerHTML`.
- Keep scroll sync tolerant of missing panes and asynchronous UI changes.
- Preserve the existing cheat sheet and about-tab open/close state model.

## CSS / UI Style

- Tailwind utility classes are the main styling mechanism in `frontend/src/main.js`.
- Custom component styles live in `frontend/src/style.css` under `@layer components`.
- Reuse the current dark slate/cyan palette unless a task clearly asks for a new direction.
- Prefer utility composition over ad hoc CSS where possible.
- Keep responsive behavior mobile-safe.
- Favor purposeful visual changes over generic boilerplate layouts.

## State and Tabs

- Keep tab state changes predictable.
- Preserve the difference between file tabs and utility tabs.
- Only mark file tabs dirty when the document actually changed.
- When closing tabs, respect unsaved changes prompts and fallback tab behavior.
- Prefer focused helper methods for tab creation, activation, and cleanup.

## Generated / Derived Files

- Do not hand-edit `frontend/wailsjs/` if regeneration is available.
- Do not assume `frontend/dist/` is checked in; it is a build artifact.
- If you regenerate Wails bindings, keep the frontend API aligned with the backend.

## File Handling

- Preserve existing open/save/cancel behavior unless a task explicitly changes it.
- Keep file type filters intact unless the request says otherwise.
- Treat canceled dialogs as normal, non-error exits.
- Keep file writes UTF-8 text unless binary output is required.

## Change Etiquette

- Match existing patterns before introducing new abstractions.
- Avoid unrelated cleanup in the same change.
- Keep backend and frontend changes aligned when they cross the Wails bridge.
- Read the smallest relevant set of files before editing.
- Check for unrelated working-tree changes before touching shared files.

## Shell / Workflow Tips

- Prefer `make` targets for routine workflows.
- Use direct `wails` commands only when you need a lower-level flow.
- Keep command output in mind when diagnosing build failures.
- Avoid adding new scripts unless there is a clear benefit.

## Notes For Future Agents

- This repository currently has no dedicated lint config beyond standard formatters.
- There are no project-specific Cursor or Copilot rule files to inherit.
- Favor targeted edits and verify them with the commands above.
