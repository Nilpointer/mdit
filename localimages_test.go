package main

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"
)

func TestLocalImageMiddleware(t *testing.T) {
	dir := t.TempDir()
	png := filepath.Join(dir, "pic.png")
	mustWrite(t, png, "\x89PNG fake")
	mustWrite(t, filepath.Join(dir, "secret.txt"), "secret")
	if err := os.Mkdir(filepath.Join(dir, "folder.png"), 0o755); err != nil {
		t.Fatal(err)
	}

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})
	handler := localImageMiddleware(next)

	tests := []struct {
		name       string
		target     string
		wantStatus int
		wantType   string
	}{
		{name: "serves image", target: localURL(png), wantStatus: http.StatusOK, wantType: "image/png"},
		{name: "rejects non-image extension", target: localURL(filepath.Join(dir, "secret.txt")), wantStatus: http.StatusNotFound},
		{name: "rejects relative path", target: localURL("pic.png"), wantStatus: http.StatusNotFound},
		{name: "rejects missing file", target: localURL(filepath.Join(dir, "missing.png")), wantStatus: http.StatusNotFound},
		{name: "rejects directory", target: localURL(filepath.Join(dir, "folder.png")), wantStatus: http.StatusNotFound},
		{name: "passes other requests through", target: "/index.html", wantStatus: http.StatusTeapot},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, tt.target, nil))
			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tt.wantStatus)
			}
			if tt.wantType != "" && rec.Header().Get("Content-Type") != tt.wantType {
				t.Errorf("Content-Type = %q, want %q", rec.Header().Get("Content-Type"), tt.wantType)
			}
		})
	}
}

func localURL(path string) string {
	return localImageRoute + "?path=" + url.QueryEscape(path)
}

func mustWrite(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}
