package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

type watchEvent struct{ name, path string }

func newTestWatcher(t *testing.T) (*fileWatcher, chan watchEvent) {
	t.Helper()
	events := make(chan watchEvent, 16)
	fw, err := newFileWatcher(func(name, path string) { events <- watchEvent{name, path} }, 50*time.Millisecond)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(fw.close)
	return fw, events
}

func expectEvent(t *testing.T, events chan watchEvent, name, path string) {
	t.Helper()
	select {
	case got := <-events:
		if got.name != name || got.path != path {
			t.Fatalf("event = %v, want %s %s", got, name, path)
		}
	case <-time.After(3 * time.Second):
		t.Fatalf("no %s event for %s", name, path)
	}
}

func expectNoEvent(t *testing.T, events chan watchEvent) {
	t.Helper()
	select {
	case got := <-events:
		t.Fatalf("unexpected event %v", got)
	case <-time.After(300 * time.Millisecond):
	}
}

func TestFileWatcher(t *testing.T) {
	dir := t.TempDir()
	doc := filepath.Join(dir, "doc.md")
	other := filepath.Join(dir, "other.md")
	mustWrite(t, doc, "v1")
	mustWrite(t, other, "x")

	fw, events := newTestWatcher(t)
	fw.setFiles([]string{doc})

	t.Run("write in place reports once per burst", func(t *testing.T) {
		mustWrite(t, doc, "v2")
		mustWrite(t, doc, "v3")
		expectEvent(t, events, "file-changed", doc)
		expectNoEvent(t, events)
	})

	t.Run("replace via rename is a change", func(t *testing.T) {
		tmp := filepath.Join(dir, ".doc.md.tmp")
		mustWrite(t, tmp, "v4")
		if err := os.Rename(tmp, doc); err != nil {
			t.Fatal(err)
		}
		expectEvent(t, events, "file-changed", doc)
	})

	t.Run("unwatched file in the same folder is ignored", func(t *testing.T) {
		mustWrite(t, other, "y")
		expectNoEvent(t, events)
	})

	t.Run("delete reports removal", func(t *testing.T) {
		if err := os.Remove(doc); err != nil {
			t.Fatal(err)
		}
		expectEvent(t, events, "file-removed", doc)
	})

	t.Run("files dropped from the set are no longer reported", func(t *testing.T) {
		fw.setFiles(nil)
		mustWrite(t, doc, "v5")
		expectNoEvent(t, events)
	})
}
