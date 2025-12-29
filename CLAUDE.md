# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

draft-zero is a desktop application built with Tauri 2, React 18, and Vite. It uses pnpm as the package manager.

## Development Commands

```bash
# Start development (runs both Vite dev server and Tauri app)
pnpm tauri dev

# Build production bundle
pnpm tauri build

# Run only the Vite frontend dev server (no Tauri)
pnpm dev
```

## Architecture

**Frontend (src/)**
- React 18 application with Vite bundler
- Entry: `src/main.jsx` → `src/App.jsx`
- Communicates with Rust backend via `invoke()` from `@tauri-apps/api/core`

**Backend (src-tauri/)**
- Rust backend using Tauri 2
- Entry: `src-tauri/src/main.rs` → calls `lib.rs::run()`
- Commands defined with `#[tauri::command]` attribute in `lib.rs`
- Capabilities/permissions configured in `src-tauri/capabilities/default.json`
- App config in `src-tauri/tauri.conf.json`

**Frontend-Backend Communication**
- Frontend calls Rust functions via `invoke("command_name", { args })`
- Rust commands must be registered in `tauri::generate_handler![]` in `lib.rs`
