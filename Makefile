WAILS ?= $(shell command -v wails 2>/dev/null)

ifeq ($(WAILS),)
WAILS := /home/andreas/.local/share/mise/installs/go/1.26.0/bin/wails
endif

.PHONY: help dev build frontend-build clean

help:
	@printf "Targets:\n"
	@printf "  make dev            Run Wails in development mode\n"
	@printf "  make build          Build production desktop app\n"
	@printf "  make frontend-build Build frontend assets only\n"
	@printf "  make clean          Remove frontend dist and Go binary\n"

dev:
	$(WAILS) dev

build:
	$(WAILS) build

frontend-build:
	npm --prefix frontend run build

clean:
	rm -rf frontend/dist
	rm -f mdit
