# Contributing to markdownReaderPro (kuro)

Thank you for your interest in contributing! This document explains how to set up the development environment and build the application from source.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Development Setup](#development-setup)
4. [Running the App (Dev Mode)](#running-the-app-dev-mode)
5. [Building for Production](#building-for-production)
6. [Running Tests](#running-tests)
7. [Contribution Guidelines](#contribution-guidelines)

---

## Prerequisites

Make sure the following tools are installed before you begin.

| Tool | Version | Install |
|------|---------|---------|
| Rust | ≥ 1.75 | [rustup.rs](https://rustup.rs) |
| Node.js | ≥ 20 LTS | [nodejs.org](https://nodejs.org) |
| pnpm | ≥ 8 | `npm install -g pnpm` |
| Tauri CLI | 2.x | `cargo install tauri-cli --version "^2.0"` |

### macOS extra dependencies
```bash
# Xcode Command Line Tools (required for linking)
xcode-select --install
```

### Linux extra dependencies
```bash
# Ubuntu / Debian
sudo apt update && sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

### Windows extra dependencies
- Install the [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).
- Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the **C++ Desktop Development** workload.

---

## Project Structure

```
markdownReaderPro/
├── src/                    # Svelte 5 frontend (TypeScript)
│   ├── lib/                # Reusable components & utilities
│   │   ├── Editor.svelte   # CodeMirror 6 editor component
│   │   ├── Preview.svelte  # Markdown preview pane
│   │   └── state.svelte.ts # Global $state definitions (Svelte 5 Runes)
│   ├── App.svelte          # Root component
│   └── main.ts             # Entry point
├── src-tauri/              # Rust backend (Tauri 2.0)
│   ├── src/
│   │   ├── main.rs         # Tauri application entry point
│   │   ├── commands.rs     # IPC command handlers (open, save, watch)
│   │   └── state.rs        # Application state struct
│   ├── capabilities/       # Tauri 2.0 capability definitions
│   ├── Cargo.toml
│   └── tauri.conf.json
├── tests/                  # End-to-end tests (Playwright)
├── CONTRIBUTING.md         # This file
├── Implementation_plan.md  # Engineering spec
└── package.json
```

---

## Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/markdownReaderPro.git
cd markdownReaderPro

# 2. Install frontend dependencies
pnpm install

# 3. Fetch Rust dependencies (first build will take a few minutes)
cargo fetch --manifest-path src-tauri/Cargo.toml
```

---

## Running the App (Dev Mode)

This starts both the Vite dev server (frontend) and the Tauri process with hot-reload:

```bash
pnpm tauri dev
```

> The first run compiles the Rust backend; subsequent runs are much faster due to incremental compilation.

---

## Building for Production

```bash
# Build a native binary for your current platform
pnpm tauri build
```

Output artifacts are placed in `src-tauri/target/release/bundle/`:

| Platform | Output |
|----------|--------|
| macOS | `*.app` + `*.dmg` |
| Linux | `*.deb` + `*.AppImage` |
| Windows | `*.msi` + `*.exe` (NSIS) |

### Cross-platform builds via CI

Production binaries for all three platforms are built automatically by the GitHub Actions pipeline on every push to `main`. See `.github/workflows/release.yml`.

---

## Running Tests

### Rust unit tests

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

### Frontend component tests (Vitest)

```bash
pnpm test
```

### End-to-end tests (Playwright)

```bash
# Make sure the app is already running with: pnpm tauri dev
pnpm exec playwright test
```

---

## Contribution Guidelines

1. **Branch naming:** `feat/<short-description>`, `fix/<short-description>`, `chore/<short-description>`.
2. **Commits:** Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) (`feat:`, `fix:`, `docs:`, `chore:`).
3. **Frontend:** Use Svelte 5 Runes (`$state`, `$derived`, `$effect`) — **do not** use Svelte 4 stores or `writable()`.
4. **Rust:** Run `cargo fmt` and `cargo clippy` before committing.
5. **TypeScript:** Run `pnpm check` (svelte-check) to catch type errors before opening a PR.
6. **Pull Requests:** Target the `main` branch. Add a short description of what changed and why.

---

*This project is maintained under the MIT License.*
