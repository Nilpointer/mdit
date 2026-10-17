package main

import (
	"context"
	"testing"
)

func TestConfirmsQuit(t *testing.T) {
	for answer, want := range map[string]bool{
		"Yes": true, "yes": true, "Quit": true, // Linux/Windows return Yes/No; macOS returns the button label
		"No": false, "Cancel": false, "": false,
	} {
		if got := confirmsQuit(answer); got != want {
			t.Errorf("confirmsQuit(%q) = %v, want %v", answer, got, want)
		}
	}
}

func TestUnsavedChangesMessage(t *testing.T) {
	if got := unsavedChangesMessage(1); got != "1 tab has unsaved changes. Quit anyway and discard them?" {
		t.Errorf("singular message = %q", got)
	}
	if got := unsavedChangesMessage(3); got != "3 tabs have unsaved changes. Quit anyway and discard them?" {
		t.Errorf("plural message = %q", got)
	}
}

func TestBeforeCloseWithoutUnsavedChanges(t *testing.T) {
	app := NewApp("")
	app.SetUnsavedChanges(2)
	app.SetUnsavedChanges(0)
	// With nothing unsaved no dialog is shown, so a bare context is enough.
	if app.beforeClose(context.Background()) {
		t.Error("beforeClose prevented closing although nothing is unsaved")
	}
}
