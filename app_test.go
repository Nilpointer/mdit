package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestMarkdownPathFromArgs(t *testing.T) {
	dir := filepath.FromSlash("/home/user/notes")
	abs := filepath.FromSlash("/tmp/todo.md")

	tests := []struct {
		name string
		args []string
		want string
	}{
		{name: "no args", args: nil, want: ""},
		{name: "relative path resolves against dir", args: []string{"readme.md"}, want: filepath.Join(dir, "readme.md")},
		{name: "absolute path kept", args: []string{abs}, want: abs},
		{name: "markdown extension", args: []string{"draft.markdown"}, want: filepath.Join(dir, "draft.markdown")},
		{name: "extension is case-insensitive", args: []string{"README.MD"}, want: filepath.Join(dir, "README.MD")},
		{name: "flags skipped", args: []string{"--verbose", "-x.md", "a.md"}, want: filepath.Join(dir, "a.md")},
		{name: "non-markdown ignored", args: []string{"image.png", "notes.txt"}, want: ""},
		{name: "first markdown wins", args: []string{"a.md", "b.md"}, want: filepath.Join(dir, "a.md")},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := markdownPathFromArgs(tt.args, dir); got != tt.want {
				t.Errorf("markdownPathFromArgs(%q) = %q, want %q", tt.args, got, tt.want)
			}
		})
	}
}

func TestWriteMarkdown(t *testing.T) {
	dir := t.TempDir()
	app := NewApp("")

	saved, err := app.writeMarkdown(filepath.Join(dir, "notes"), "# Notes\n")
	if err != nil {
		t.Fatal(err)
	}
	if want := filepath.Join(dir, "notes.md"); saved != want {
		t.Errorf("path without extension saved as %q, want %q", saved, want)
	}
	info, err := os.Stat(saved)
	if err != nil {
		t.Fatal(err)
	}
	if perm := info.Mode().Perm(); perm&0o600 != 0o600 || perm&0o022 != 0 {
		t.Errorf("file mode = %v, want owner read/write and no group/other write", perm)
	}
	if content, _ := os.ReadFile(saved); string(content) != "# Notes\n" {
		t.Errorf("content = %q", content)
	}
	if app.lastOpenDir != dir {
		t.Errorf("lastOpenDir = %q, want %q", app.lastOpenDir, dir)
	}

	txt, err := app.writeMarkdown(filepath.Join(dir, "plain.txt"), "x")
	if err != nil || filepath.Ext(txt) != ".txt" {
		t.Errorf("explicit extension changed: %q, %v", txt, err)
	}
}

func TestReadFileMissing(t *testing.T) {
	if _, err := NewApp("").ReadFile(filepath.Join(t.TempDir(), "missing.md")); err == nil {
		t.Error("ReadFile of a missing file returned no error")
	}
}
