Here is the architectural blueprint for the Markdown reader/editor

---

## 1. High-Level Architecture: The "Core-Shell" Model

We treat the Rust backend as the **Kernel** (managing state, files, and OS integration) and the TypeScript frontend as the **Projection Layer** (rendering and user interaction).



### **The Technology Stack**
* **Backend:** Rust (Tauri 2.0).
* **Frontend:** TypeScript + Svelte (Svelte is chosen over React here for its lack of a virtual DOM, resulting in a smaller bundle and faster reactive updates—critical for a "lightweight" feel).
* **Markdown Engine:** `unified` / `remark` / `rehype`. This ecosystem treats Markdown as a **Syntax Tree (AST)**, allowing us to inject metadata for scroll synchronization.

---

## 2. Component Design: Dual-Pane vs. Reader Mode

The UI is a state machine with two primary layouts.

### **The Layout Logic**
* **Editor Mode:** A split-view flexbox.
* **Reader Mode:** A centered, max-width container where the editor is unmounted or hidden to reclaim memory.

```typescript
// Conceptual State Definition
type AppMode = 'Edit' | 'Read';

interface AppState {
  mode: AppMode;
  content: string;
  filePath: string | null;
  isDirty: boolean;
}
```

---

## 3. The Synchronization Algorithm: Mathematical Interpolation

Synchronizing scroll between a plain-text `textarea` (or CodeMirror) and a rendered HTML preview is not a simple 1:1 linear mapping because an image in the preview might take up 500px, while its Markdown source `![alt](url)` takes up only 1 line.

### **The Theoretical Approach: Anchor-Based Mapping**
We map the **Line Index ($L$)** of the source to the **DOM Offset ($Y$)** of the preview.

1.  **Inject Source Maps:** During the Markdown-to-HTML conversion, inject the line number as a data attribute into every HTML element: `<h1 data-line="10">`.
2.  **The Mapping Function:** Create a Map/Array of pairs: $M = [(L_0, Y_0), (L_1, Y_1), ... (L_n, Y_n)]$.
3.  **Linear Interpolation:** When the editor scrolls to line $l$, where $L_i \le l < L_{i+1}$, calculate the preview scroll position $y$ using:

$$y = Y_i + (Y_{i+1} - Y_i) \cdot \frac{l - L_i}{L_{i+1} - L_i}$$

This ensures that the header currently at the top of your editor is exactly at the top of your preview, regardless of image sizes or font scaling.

---

## 4. Multi-byte (Japanese) Considerations

For a Japanese-first experience, we must address **Typography** and **Encoding**.

* **Font Fallback (CSS):** Ensure the CSS stack respects Japanese characters across platforms.
    ```css
    font-family: "Helvetica Neue", "Arial", "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Meiryo", sans-serif;
    ```
* **IME Ghosting Prevention:** In Svelte/React, ensure that the `content` state is not updated *during* an active IME composition, as re-rendering the component can break the composition buffer. Use the `compositionstart` and `compositionend` flags to gate state updates.

---

## 5. Backend Logic (Rust): The "Pragmatic Rigor"

The Rust backend should handle file I/O using **Buffered Streams** and **Atomic Writes** to prevent data loss.

### **File Watcher (The Academic Touch)**
Use the `notify` crate in Rust. If the user edits the file in a separate terminal (e.g., `vim`), the Tauri app should detect the change and prompt for a reload—essential for a "pro" tool.

```rust
// src-tauri/src/main.rs
#[tauri::command]
async fn read_markdown_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn atomic_save(path: String, content: String) -> Result<(), String> {
    let temp_path = format!("{}.tmp", path);
    tokio::fs::write(&temp_path, content).await.map_err(|e| e.to_string())?;
    tokio::fs::rename(temp_path, path).await.map_err(|e| e.to_string())
}
```
