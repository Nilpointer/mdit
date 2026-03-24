package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx context.Context
}

type FilePayload struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) OpenFile() (*FilePayload, error) {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Open Markdown File",
		Filters: []runtime.FileFilter{
			{DisplayName: "Markdown files (*.md, *.markdown)", Pattern: "*.md;*.markdown"},
			{DisplayName: "Text files (*.txt)", Pattern: "*.txt"},
			{DisplayName: "All files", Pattern: "*"},
		},
	})
	if err != nil {
		return nil, err
	}
	if path == "" {
		return nil, nil
	}

	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	return &FilePayload{Path: path, Content: string(content)}, nil
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

	if err := os.WriteFile(savePath, []byte(content), 0o644); err != nil {
		return "", err
	}

	return savePath, nil
}
