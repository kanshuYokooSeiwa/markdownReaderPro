
---

# Development Plan: markdwonReaderPro Markdown Editor/Reader
**Architecture:** Tauri (Rust) + Svelte (TS) + CodeMirror 6

code name kuro 

## 1. Executive Summary
The goal is to build a cross-platform (macOS, Linux, Windows) Markdown application that maintains a memory footprint < 100MB while providing enterprise-grade Japanese IME support and sub-millisecond sync-scroll between source and preview.

---

## 2. Technical Specification
### Core Stack
- **Backend (Kernel):** Rust 1.75+ (Tauri 2.0)
- **Frontend (UI):** Svelte 4/5 (No Virtual DOM for maximum performance)
- **Editor Engine:** CodeMirror 6 (Modular architecture)
- **Markdown Pipeline:** Unified.js (`remark` for AST parsing, `rehype` for HTML transformation)
- **Styling:** TailwindCSS (utility-first, purged for minimal CSS bundle)

### Data Flow Model
We will implement a **Unidirectional Data Flow** with a synchronized state between the Rust backend and the Svelte frontend via Tauri's IPC (Inter-Process Communication).

---

## 3. Phase-by-Phase Roadmap

### Phase 1: The Foundation (Infrastructure & IPC)
* **Tauri Scaffolding:** Initialize Rust backend with optimized build profiles (`panic = "abort"`, `lto = true`).
* **Security Layer:** Configure Tauri's `allowlist` to restrict File System access to specific user-defined directories.
* **State Management:** Implement a Rust `struct` for Application State (File Path, IsDirty, ViewMode) and manage it via `tauri::State`.
* **Commands:** Create the initial IPC bridge: `open_file`, `save_file`, `watch_file`.

### Phase 2: The "Brain" (Editor & IME)
* **CM6 Integration:** Implement the `EditorView` as a Svelte component.
* **Japanese IME Handling:** * Implement "Composition Gating" to prevent Svelte reactivity from interrupting the IME buffer.
    * Configure `line-height` and `font-family` fallbacks specifically for Windows (Meiryo/Yu Gothic) and macOS (Hiragino).
* **Themed Syntax Highlighting:** Use `lezer-markdown` for the CM6 parser to ensure $O(n)$ highlighting performance.

### Phase 3: The Projection (Markdown Engine)
* **Unified Pipeline:**
    1.  `remark-parse` $\rightarrow$ Markdown AST (MDAST).
    2.  **Custom Plugin:** `remark-line-number` — Injects `data-line` attributes into the AST nodes.
    3.  `remark-rehype` $\rightarrow$ HTML AST (HAST).
    4.  `rehype-stringify` $\rightarrow$ Sanitized HTML string.
* **Asset Management:** Implement a custom Tauri protocol (`kuro-asset://`) to render local images in the preview without compromising security.

### Phase 4: The Sync-Scroll & Reader Mode
* **The Interpolation Engine:** Implement the mathematical mapping of Editor line-heights to Preview DOM offsets.
* **Reader Mode (Zen Mode):**
    * A CSS-driven transition that unmounts the Editor pane.
    * Implementation of "Focus Mode" (highlighting only the current paragraph).
* **Typography Optimization:** Apply `text-rendering: optimizeLegibility` and `font-feature-settings: "palt"` (Proportional Alternate) for Japanese glyphs.

### Phase 5: Hardening & Distribution
* **Memory Profiling:** Use `valgrind` (Linux) and `Instruments` (macOS) to identify memory leaks in the Rust-JS bridge.
* **Multi-Platform CI/CD:** Github Actions pipeline to build `.app`, `.deb`, and `.msi` binaries.
* **Automated Testing:** * Rust: Unit tests for file I/O safety.
    * Playwright: End-to-end tests for Japanese character input and file saving.

---

## 4. Key Technical Challenges & Solutions

### Challenge A: The "Save" Race Condition
**Risk:** Saving a file while the user is still typing can lead to file corruption or lost bytes.
**Solution:** Implement **Atomic Saving** in Rust. Write to a `.tmp` file first, then `rename` to the original path. This is a POSIX-compliant method ensuring data integrity.

### Challenge B: Scroll Jitter
**Risk:** On high-refresh-rate monitors (120Hz+), synchronization can look "jumpy."
**Solution:** Use `requestAnimationFrame` and a **Linear Interpolation (Lerp)** function for the scroll position to smooth out the transition between the editor and preview.

---

## 5. Definition of Done (DoD)
- [ ] Application launches in under 1.5 seconds.
- [ ] Idle memory usage stays below 80MB.
- [ ] Japanese text input (IME) shows zero lag during conversion.
- [ ] Sync-scroll accurately aligns headers within 5 pixels.
- [ ] Reader mode renders 10,000+ words without UI stuttering.

---

## 6. Future Expansion (V2)
- **V2.1:** Mermaid.js support for diagrams.
- **V2.2:** MathJax/KaTeX integration for scientific Markdown.
- **V2.3:** Vim-mode bindings via CM6 extension.

---

This plan balances the **Theoretical Elegance** of the Unified AST pipeline with the **Pragmatic Rigor** of Rust's safety and Tauri's lightweight footprint. 

Shall we proceed with the **Phase 1** implementation of the Rust `save_file` command with atomic writing?