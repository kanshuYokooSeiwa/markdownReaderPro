# Implementation Plan: Japanese PDF Reading Feature

## 1. Executive Summary
This plan outlines the implementation of a PDF reading feature for the MarkdownReaderPro application. A critical requirement is robust support for Japanese language PDFs. Due to the complexities of PDF font encodings (CID fonts, custom ToUnicode mappings), this feature requires careful architectural decisions to ensure accurate text rendering and extraction without garbled text (mojibake).

## 2. Technical Approach & Architecture

We will handle the PDF processing primarily on the **Frontend (Svelte)** using Mozilla's **`pdf.js`**, rather than a pure Rust backend approach.
*Reasoning:* `pdf.js` has industry-leading, built-in support for complex Japanese fonts via its CMap (Character Map) dictionaries, which are notoriously difficult to handle in pure Rust PDF crates without linking heavy C++ libraries (like PDFium).

### Key Components
- **Library:** `pdfjs-dist` (Mozilla's PDF.js)
- **Asset Handling:** Host CMap files (`pdfjs-dist/cmaps/`) as static assets to ensure Japanese fonts decode correctly.
- **Backend (Tauri/Rust):** Responsible for securely reading the raw PDF file bytes from the local filesystem and sending them to the frontend via IPC.

## 3. Core Features to Implement

1. **PDF Rendering View:** A mode to display PDF pages natively within the app.
2. **Japanese Text Extraction (Import):** Extracting text from the PDF to populate the Markdown editor.
3. **Split-Pane PDF/Markdown:** (Optional but recommended) Viewing the PDF on one side while taking notes in Markdown on the other.

## 4. Phase-by-Phase Implementation Roadmap

### Phase 1: Setup and Infrastructure
* **Dependency Installation:** Add `pdfjs-dist` to the Svelte frontend dependencies.
* **CMap Asset Configuration:** Configure Vite/SvelteKit to serve the `pdfjs-dist/cmaps/` directory as static assets. This is **mandatory** for Japanese text to avoid rendering boxes or missing characters.
* **Tauri IPC Command:** Create a Rust command (`read_pdf_file`) that reads a PDF file into a `Vec<u8>` and returns it to the frontend, bypassing frontend browser sandbox limitations.

### Phase 2: PDF Rendering (The Viewer)
* **Svelte Component (`PdfViewer.svelte`):** Create a component that initializes the `pdf.js` worker.
* **Worker Configuration:** Configure the `GlobalWorkerOptions.workerSrc`.
* **CMap Initialization:** Set `cMapUrl` and `cMapPacked: true` in the `getDocument` configuration to ensure Japanese characters are mapped correctly.
* **Canvas Rendering:** Render PDF pages to an HTML `<canvas>` element.

### Phase 3: Japanese Text Extraction (PDF to Markdown)
* **Text Layer Extraction:** Utilize `pdf.js`'s `getTextContent()` API to extract text items from the PDF.
* **Japanese Layout Heuristics:**
    * Handle implicit line breaks. In Japanese, newline characters might break words awkwardly. We need logic to concatenate Japanese characters seamlessly while preserving paragraph breaks.
    * Handle vertical text (Tate-gaki) if necessary.
* **Editor Integration:** Provide an "Import PDF Text" action that takes the extracted text, applies basic Markdown formatting (e.g., detecting headings based on font size from `getTextContent`), and loads it into the CodeMirror editor.

### Phase 4: Performance & Optimization
* **Web Worker:** Ensure `pdf.js` runs entirely in a Web Worker so heavy Japanese PDFs do not block the Svelte UI thread.
* **Lazy Loading:** Only render the visible pages of the PDF using an Intersection Observer to keep the memory footprint under the <100MB project goal.

## 5. Technical Challenges & Japanese Specifics

### Challenge A: Mojibake (Garbled Text)
**Risk:** PDFs often don't embed full Japanese fonts. They use CID (Character Identifier) fonts that require external mappings.
**Solution:** The explicit use of `cMapUrl: '/cmaps/'` instructs `pdf.js` to download the standard Japanese mapping tables, guaranteeing correct character decoding.

### Challenge B: Text Selection and Copying
**Risk:** Canvas-rendered PDFs cannot be highlighted or copied.
**Solution:** Implement the `pdf.js` "TextLayer" (an invisible HTML overlay matching the canvas text positions) to allow users to select and copy Japanese text accurately.

### Challenge C: Vertical Text Layouts
**Risk:** Many Japanese documents use vertical text, which extracts out of order if not handled properly.
**Solution:** Use the text item transformation matrices provided by `getTextContent()` to sort characters positionally rather than purely by logical sequence.
