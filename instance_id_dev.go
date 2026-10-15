//go:build dev

package main

// instanceID differs in `wails dev` builds so a dev build never forwards its files to an installed mdit.
const instanceID = "io.github.Nilpointer.mdit.dev"
