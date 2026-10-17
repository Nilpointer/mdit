package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx         context.Context
	lastOpenDir string
	watcher     *fileWatcher

	// mu guards state shared between bound methods and OS callbacks:
	// the startup hand-off with the frontend and the unsaved-changes count.
	mu              sync.Mutex
	startupFilePath string
	frontendReady   bool
	unsavedCount    int
}

type FilePayload struct {
	Path    string `json:"path"`
	Title   string `json:"title"`
	Content string `json:"content"`
}

// NewApp creates a new App application struct
func NewApp(startupFilePath string) *App {
	return &App{startupFilePath: startupFilePath}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	watcher, err := newFileWatcher(func(event, path string) {
		runtime.EventsEmit(ctx, event, path)
	}, 200*time.Millisecond)
	if err == nil {
		a.watcher = watcher
	}
}

// shutdown is called when the app exits.
func (a *App) shutdown(ctx context.Context) {
	if a.watcher != nil {
		a.watcher.close()
	}
}

// SetWatchedFiles replaces the set of open files watched for changes made outside mdit.
// Changes arrive in the frontend as "file-changed" / "file-removed" events with the path.
func (a *App) SetWatchedFiles(paths []string) {
	if a.watcher != nil {
		a.watcher.setFiles(paths)
	}
}

func (a *App) readFilePayload(path string) (*FilePayload, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	a.lastOpenDir = filepath.Dir(path)
	return &FilePayload{Path: path, Title: filepath.Base(path), Content: string(content)}, nil
}

// isMarkdownPath reports whether path has a Markdown file extension.
func isMarkdownPath(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	return ext == ".md" || ext == ".markdown"
}

// markdownPathFromArgs returns the first Markdown file argument as an absolute path.
// Relative paths are resolved against dir, the working directory of the launch that passed them.
func markdownPathFromArgs(args []string, dir string) string {
	for _, arg := range args {
		if strings.HasPrefix(arg, "-") || !isMarkdownPath(arg) {
			continue
		}
		if !filepath.IsAbs(arg) && dir != "" {
			arg = filepath.Join(dir, arg)
		}
		if absPath, err := filepath.Abs(arg); err == nil {
			return absPath
		}
		return arg
	}
	return ""
}

// onSecondInstanceLaunch runs in the first instance when mdit is started again.
// A Markdown file passed to the new launch opens as a tab here, and this window comes to the front.
func (a *App) onSecondInstanceLaunch(data options.SecondInstanceData) {
	if path := markdownPathFromArgs(data.Args, data.WorkingDirectory); path != "" {
		a.openFileFromOS(path)
	}
	runtime.WindowUnminimise(a.ctx)
	runtime.Show(a.ctx)
}

// GetStartupFile returns the Markdown file passed on the command line, once.
// The frontend pulls it after it is ready, so the file cannot be lost to a startup race.
// It returns nil, nil when no file was passed or it was already handed out.
func (a *App) GetStartupFile() (*FilePayload, error) {
	a.mu.Lock()
	startupPath := strings.TrimSpace(a.startupFilePath)
	a.startupFilePath = ""
	a.frontendReady = true
	a.mu.Unlock()

	if startupPath == "" || !isMarkdownPath(startupPath) {
		return nil, nil
	}

	return a.readFilePayload(startupPath)
}

// openFileFromOS handles files handed to the running app: macOS Finder double-click or
// "Open With" (macOS does not pass these as command-line arguments), and files passed to a
// second launch on any platform (see onSecondInstanceLaunch).
// Until the frontend has pulled the startup file, the path becomes the startup file.
// After that it is sent to the frontend as an "open-file" event and opens in a new tab.
func (a *App) openFileFromOS(path string) {
	a.mu.Lock()
	if !a.frontendReady {
		a.startupFilePath = path
		a.mu.Unlock()
		return
	}
	a.mu.Unlock()

	payload, err := a.readFilePayload(path)
	if err != nil {
		runtime.EventsEmit(a.ctx, "open-file-error", err.Error())
		return
	}

	runtime.EventsEmit(a.ctx, "open-file", payload)
}

func (a *App) OpenFile() (*FilePayload, error) {
	dialogOptions := runtime.OpenDialogOptions{
		Title: "Open Markdown File",
		Filters: []runtime.FileFilter{
			{DisplayName: "Markdown files (*.md, *.markdown)", Pattern: "*.md;*.markdown"},
			{DisplayName: "Text files (*.txt)", Pattern: "*.txt"},
			{DisplayName: "All files", Pattern: "*"},
		},
	}

	if a.lastOpenDir != "" {
		dialogOptions.DefaultDirectory = a.lastOpenDir
	}

	path, err := runtime.OpenFileDialog(a.ctx, dialogOptions)
	if err != nil {
		return nil, err
	}
	if path == "" {
		return nil, nil
	}

	a.lastOpenDir = filepath.Dir(path)

	return a.readFilePayload(path)
}

// SaveFile writes content to currentPath, or asks for a path when the document has none yet.
// It returns "" when the user cancels the dialog.
func (a *App) SaveFile(content, currentPath string) (string, error) {
	savePath := strings.TrimSpace(currentPath)
	if savePath == "" {
		return a.SaveFileAs(content, "")
	}
	return a.writeMarkdown(savePath, content)
}

// SaveFileAs always asks for a path, starting at the current file's folder and name.
// It returns "" when the user cancels the dialog.
func (a *App) SaveFileAs(content, currentPath string) (string, error) {
	dialogOptions := runtime.SaveDialogOptions{
		Title:           "Save Markdown File",
		DefaultFilename: "document.md",
		Filters: []runtime.FileFilter{
			{DisplayName: "Markdown files (*.md)", Pattern: "*.md"},
			{DisplayName: "Text files (*.txt)", Pattern: "*.txt"},
		},
	}
	if path := strings.TrimSpace(currentPath); path != "" {
		dialogOptions.DefaultDirectory = filepath.Dir(path)
		dialogOptions.DefaultFilename = filepath.Base(path)
	} else if a.lastOpenDir != "" {
		dialogOptions.DefaultDirectory = a.lastOpenDir
	}

	selectedPath, err := runtime.SaveFileDialog(a.ctx, dialogOptions)
	if err != nil {
		return "", err
	}
	if selectedPath == "" {
		return "", nil
	}
	return a.writeMarkdown(selectedPath, content)
}

// writeMarkdown writes UTF-8 text to path, appending .md when the path has no extension.
func (a *App) writeMarkdown(path, content string) (string, error) {
	if filepath.Ext(path) == "" {
		path += ".md"
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		return "", err
	}

	a.lastOpenDir = filepath.Dir(path)
	return path, nil
}

// ReadFile reads a Markdown file by path, for reopening recent files, restoring the
// session, dropped files and reloading files that changed on disk.
func (a *App) ReadFile(path string) (*FilePayload, error) {
	return a.readFilePayload(path)
}
