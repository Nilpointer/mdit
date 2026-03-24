# mdit

## AI SLOP ##

### Disclaimer: This project is 100% AI generated!

-----------------

mdit is a desktop Markdown viewer/editor built with **Golang + Wails**.

It provides a split-pane workspace:
- left pane: Markdown source editor
- right pane: live rendered preview

## Features

- Live Markdown rendering (`marked` + `DOMPurify`)
- Top menu bar with file/edit/view/help menus
- Open and save Markdown files through native dialogs
- Undo/redo history in the editor
- View menu toggles to show/hide source or preview pane
- Integrated Markdown cheat sheet with state restore on close
- External link opening via Wails browser integration
- Responsive split layout for narrower windows

## Tech Stack

- Backend: Go + Wails v2
- Frontend: Vanilla JS + Alpine.js + TailwindCSS + Vite

## Prerequisites

- Go (see `go.mod`)
- Node.js / npm
- Wails CLI

Install Wails CLI:

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

### Linux notes

On modern Fedora/Ubuntu setups using WebKitGTK 4.1, build with:

```bash
wails build -tags webkit2_41
```

Fedora packages typically required:

```bash
sudo dnf install gcc pkgconf-pkg-config glib2-devel gtk3-devel webkit2gtk4.1-devel libsoup3-devel
```

## Run in Development

From project root:

```bash
make dev
```

Equivalent direct command:

```bash
wails dev
```

## Build

With Makefile:

```bash
make build
```

Linux WebKit 4.1 example:

```bash
wails build -clean -tags webkit2_41
```

## Make Targets

- `make help` - list targets
- `make dev` - run Wails dev mode
- `make build` - production build
- `make frontend-build` - build frontend only
- `make clean` - remove local build outputs

## Releases

GitHub Actions workflow at `.github/workflows/release.yml` builds release artifacts for:

- Linux
- Windows
- macOS

Trigger a release by pushing a version tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```
