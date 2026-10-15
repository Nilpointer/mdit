package main

import (
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
