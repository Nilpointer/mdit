package main

import (
	"embed"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var appIcon []byte

func main() {
	startupFilePath := ""
	for _, arg := range os.Args[1:] {
		if strings.HasPrefix(arg, "-") {
			continue
		}
		if strings.EqualFold(filepath.Ext(arg), ".md") {
			if absPath, err := filepath.Abs(arg); err == nil {
				startupFilePath = absPath
			} else {
				startupFilePath = arg
			}
			break
		}
	}

	// Create an instance of the app structure
	app := NewApp(startupFilePath)

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "mdit",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		OnDomReady:       app.domReady,
		Linux: &linux.Options{
			Icon:        appIcon,
			ProgramName: "mdit",
		},
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
