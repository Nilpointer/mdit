package main

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// localImageRoute is where the preview loads images from disk: /mdit-local?path=<absolute path>.
// The frontend rewrites local <img> sources to this route (see resolveLocalImages in main.js).
const localImageRoute = "/mdit-local"

var localImageTypes = map[string]string{
	".apng": "image/apng",
	".avif": "image/avif",
	".bmp":  "image/bmp",
	".gif":  "image/gif",
	".ico":  "image/x-icon",
	".jpeg": "image/jpeg",
	".jpg":  "image/jpeg",
	".png":  "image/png",
	".svg":  "image/svg+xml",
	".webp": "image/webp",
}

// localImageMiddleware serves local images for the Markdown preview and passes every other
// request on to the regular asset server.
func localImageMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != localImageRoute {
			next.ServeHTTP(w, r)
			return
		}
		serveLocalImage(w, r)
	})
}

// serveLocalImage only serves absolute paths to regular files with an image extension,
// so a document cannot use the route to read other local files.
func serveLocalImage(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	contentType, ok := localImageTypes[strings.ToLower(filepath.Ext(path))]
	if !ok || !filepath.IsAbs(path) {
		http.NotFound(w, r)
		return
	}

	file, err := os.Open(filepath.Clean(path))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	// SVGs may carry scripts; they never run in <img>, and this blocks them if opened directly.
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'")
	w.Header().Set("Cache-Control", "no-cache")
	http.ServeContent(w, r, info.Name(), info.ModTime(), file)
}
