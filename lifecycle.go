package main

import (
	"context"
	"fmt"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// SetUnsavedChanges records how many tabs have unsaved changes. The frontend reports every change,
// so beforeClose can warn without asking the frontend at quit time.
func (a *App) SetUnsavedChanges(count int) {
	a.mu.Lock()
	a.unsavedCount = count
	a.mu.Unlock()
}

// beforeClose runs when the window is closed or the app quits (including Ctrl+Q, which calls Quit).
// It returns true to keep the app open when there are unsaved changes and the user cancels.
func (a *App) beforeClose(ctx context.Context) bool {
	a.mu.Lock()
	count := a.unsavedCount
	a.mu.Unlock()
	if count == 0 {
		return false
	}

	answer, err := runtime.MessageDialog(ctx, runtime.MessageDialogOptions{
		Type:          runtime.QuestionDialog,
		Title:         "Unsaved changes",
		Message:       unsavedChangesMessage(count),
		Buttons:       []string{"Quit", "Cancel"},
		DefaultButton: "Cancel",
		CancelButton:  "Cancel",
	})
	if err != nil {
		// Never lose work because the dialog failed to open.
		return true
	}

	return !confirmsQuit(answer)
}

func unsavedChangesMessage(count int) string {
	if count == 1 {
		return "1 tab has unsaved changes. Quit anyway and discard them?"
	}
	return fmt.Sprintf("%d tabs have unsaved changes. Quit anyway and discard them?", count)
}

// confirmsQuit interprets the dialog answer. Linux and Windows always show Yes/No and return
// "Yes"/"No"; macOS shows the given buttons and returns the chosen label.
func confirmsQuit(answer string) bool {
	return strings.EqualFold(answer, "yes") || strings.EqualFold(answer, "quit")
}
