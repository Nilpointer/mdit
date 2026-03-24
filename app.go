package main

import (
	"context"
	"fmt"
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

func (a *App) ExportHTML(renderedHTML, sourcePath string) (string, error) {
	baseName := "document"
	trimmedSource := strings.TrimSpace(sourcePath)
	if trimmedSource != "" {
		baseName = strings.TrimSuffix(filepath.Base(trimmedSource), filepath.Ext(trimmedSource))
	}
	if baseName == "" {
		baseName = "document"
	}

	exportPath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Export HTML",
		DefaultFilename: baseName + ".html",
		Filters: []runtime.FileFilter{
			{DisplayName: "HTML files (*.html)", Pattern: "*.html"},
		},
	})
	if err != nil {
		return "", err
	}
	if exportPath == "" {
		return "", nil
	}
	if filepath.Ext(exportPath) == "" {
		exportPath += ".html"
	}

	document := fmt.Sprintf(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>%s</title>
  <style>
    body { max-width: 860px; margin: 2rem auto; padding: 0 1rem; line-height: 1.65; font-family: "Segoe UI", sans-serif; color: #0f172a; }
    pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.9rem; overflow: auto; }
    code { background: #f1f5f9; padding: 0.15rem 0.35rem; border-radius: 4px; }
    pre code { background: transparent; padding: 0; }
    blockquote { border-left: 4px solid #cbd5e1; margin: 1rem 0; padding-left: 1rem; color: #334155; }
    table { border-collapse: collapse; width: 100%%; }
    th, td { border: 1px solid #e2e8f0; padding: 0.45rem 0.6rem; text-align: left; }
  </style>
</head>
<body>
%s
</body>
</html>
`, baseName, renderedHTML)

	if err := os.WriteFile(exportPath, []byte(document), 0o644); err != nil {
		return "", err
	}

	return exportPath, nil
}
