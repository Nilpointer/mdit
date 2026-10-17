package main

import (
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

// fileWatcher reports changes to the files open in tabs. It watches their parent folders,
// because editors and git usually replace a file (write a temp file, then rename it over the
// original), which ends a watch on the file itself.
type fileWatcher struct {
	watcher *fsnotify.Watcher
	emit    func(event, path string)
	delay   time.Duration

	mu     sync.Mutex
	files  map[string]bool
	dirs   map[string]bool
	timers map[string]*time.Timer
}

// newFileWatcher starts watching. emit receives "file-changed" or "file-removed" with the path,
// once per burst of changes (after delay without further events for that file).
func newFileWatcher(emit func(event, path string), delay time.Duration) (*fileWatcher, error) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	fw := &fileWatcher{
		watcher: watcher,
		emit:    emit,
		delay:   delay,
		files:   map[string]bool{},
		dirs:    map[string]bool{},
		timers:  map[string]*time.Timer{},
	}
	go fw.loop()
	return fw, nil
}

// setFiles replaces the watched set with paths (the files currently open in tabs).
func (fw *fileWatcher) setFiles(paths []string) {
	files := map[string]bool{}
	dirs := map[string]bool{}
	for _, path := range paths {
		if path == "" {
			continue
		}
		clean := filepath.Clean(path)
		files[clean] = true
		dirs[filepath.Dir(clean)] = true
	}

	fw.mu.Lock()
	defer fw.mu.Unlock()
	for dir := range fw.dirs {
		if !dirs[dir] {
			_ = fw.watcher.Remove(dir)
			delete(fw.dirs, dir)
		}
	}
	for dir := range dirs {
		if !fw.dirs[dir] && fw.watcher.Add(dir) == nil {
			fw.dirs[dir] = true
		}
	}
	fw.files = files
}

func (fw *fileWatcher) loop() {
	for {
		select {
		case event, ok := <-fw.watcher.Events:
			if !ok {
				return
			}
			fw.schedule(filepath.Clean(event.Name))
		case _, ok := <-fw.watcher.Errors:
			if !ok {
				return
			}
		}
	}
}

// schedule (re)starts the debounce timer for a watched file, so a burst of events reports once.
func (fw *fileWatcher) schedule(path string) {
	fw.mu.Lock()
	defer fw.mu.Unlock()
	if !fw.files[path] {
		return
	}
	if timer := fw.timers[path]; timer != nil {
		timer.Stop()
	}
	fw.timers[path] = time.AfterFunc(fw.delay, func() { fw.settle(path) })
}

// settle runs once the file has been quiet and reports whether it still exists,
// so a delete followed by a re-create (a replace) counts as a change.
func (fw *fileWatcher) settle(path string) {
	fw.mu.Lock()
	delete(fw.timers, path)
	watched := fw.files[path]
	fw.mu.Unlock()
	if !watched {
		return
	}

	if _, err := os.Stat(path); err != nil {
		fw.emit("file-removed", path)
		return
	}
	fw.emit("file-changed", path)
}

func (fw *fileWatcher) close() {
	fw.mu.Lock()
	for _, timer := range fw.timers {
		timer.Stop()
	}
	fw.files = map[string]bool{}
	fw.mu.Unlock()
	_ = fw.watcher.Close()
}
