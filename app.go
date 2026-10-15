package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx         context.Context
	lastOpenDir string

	// mu guards the startup hand-off between OS file-open callbacks and the frontend.
	mu              sync.Mutex
	startupFilePath string
	frontendReady   bool
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

func (a *App) SaveFile(content, currentPath string) (string, error) {
	savePath := strings.TrimSpace(currentPath)
	if savePath == "" {
		selectedPath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
			Title:           "Save Markdown File",
			DefaultFilename: "document.md",
			Filters: []runtime.FileFilter{
				{DisplayName: "Markdown files (*.md)", Pattern: "*.md"},
				{DisplayName: "Text files (*.txt)", Pattern: "*.txt"},
			},
		})
		if err != nil {
			return "", err
		}
		if selectedPath == "" {
			return "", nil
		}
		savePath = selectedPath
	}

	if filepath.Ext(savePath) == "" {
		savePath += ".md"
	}

	a.lastOpenDir = filepath.Dir(savePath)

	if err := os.WriteFile(savePath, []byte(content), 0o644); err != nil {
		return "", err
	}

	return savePath, nil
}
