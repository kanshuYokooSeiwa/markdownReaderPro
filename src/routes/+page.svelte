<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { open, save } from "@tauri-apps/plugin-dialog";
  import { listen } from "@tauri-apps/api/event";
  import { WebviewWindow, getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
  import { onMount } from "svelte";
  import Editor from "$lib/components/Editor.svelte";
  import PdfViewer from "$lib/components/PdfViewer.svelte";
  import { processMarkdown } from "$lib/markdown";
  import { extractTextFromPdf } from "$lib/pdf";

  let content = $state("");
  let isPdf = $state(false);
  let pdfData = $state<Uint8Array | null>(null);
  let filePath = $state<string | null>(null);
  let isDirty = $state(false);
  let viewMode = $state<"editor" | "reader" | "split">("reader");
  let htmlContent = $state("");

  let wordCount = $derived(content.trim().split(/\s+/).filter(w => w.length > 0).length);

  let initialContent = "";
  
  // Sync-Scroll State
  let topVisibleLine = $state(1);
  let previewPaneRef = $state<HTMLDivElement | null>(null);
  let activeElement = $state<HTMLElement | null>(null);

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "editor") {
      viewMode = "editor";
    }

    const unlisteners: (() => void)[] = [];

    const ifFocused = (fn: () => void | Promise<void>) => async () => {
      const win = getCurrentWebviewWindow();
      if (await win.isFocused()) {
        fn();
      }
    };

    listen("menu-open-file", ifFocused(handleOpen)).then(unlisten => unlisteners.push(unlisten));
    listen("menu-save-file", ifFocused(handleSave)).then(unlisten => unlisteners.push(unlisten));
    
    listen("menu-save-as", ifFocused(handleSaveAs)).then(unlisten => unlisteners.push(unlisten));

    listen("menu-close", ifFocused(async () => {
      const win = getCurrentWebviewWindow();
      await win.close();
    })).then(unlisten => unlisteners.push(unlisten));

    return () => {
      unlisteners.forEach(fn => fn());
    };
  });

  // Watch for changes in content to update isDirty and process markdown
  $effect(() => {
    if (content !== initialContent) {
      isDirty = true;
    } else {
      isDirty = false;
    }
    
    processMarkdown(content, filePath).then(res => {
      htmlContent = res;
    }).catch(console.error);
  });

  // Sync state to Rust backend
  $effect(() => {
    invoke("sync_state", { isDirty, viewMode }).catch(console.error);
  });

  // Interpolation Engine for Sync Scroll
  let lerpTicking = false;
  let targetScroll = 0;
  let currentScroll = 0;

  function lerp(start: number, end: number, factor: number) {
    return start + (end - start) * factor;
  }

  function animateScroll() {
    if (!previewPaneRef) {
      lerpTicking = false;
      return;
    }
    
    currentScroll = lerp(currentScroll, targetScroll, 0.1);
    
    if (Math.abs(targetScroll - currentScroll) < 1) {
      previewPaneRef.scrollTop = targetScroll;
      lerpTicking = false;
    } else {
      previewPaneRef.scrollTop = currentScroll;
      window.requestAnimationFrame(animateScroll);
    }
  }

  $effect(() => {
    if ((viewMode === 'split' || viewMode === 'reader') && previewPaneRef) {
      const elements = Array.from(previewPaneRef.querySelectorAll('[data-line]'));
      let targetElement = elements[0] as HTMLElement | undefined;
      
      for (const el of elements) {
        const line = parseInt(el.getAttribute('data-line') || '1', 10);
        if (line <= topVisibleLine) {
          targetElement = el as HTMLElement;
        } else {
          break;
        }
      }

      if (targetElement) {
        // Manage Focus Mode
        if (activeElement) {
          activeElement.classList.remove('active-paragraph');
        }
        targetElement.classList.add('active-paragraph');
        activeElement = targetElement;

        // Calculate Scroll
        // Offset by a little bit so it's not flush at the top
        targetScroll = Math.max(0, targetElement.offsetTop - previewPaneRef.offsetTop - 40); 
        
        if (!lerpTicking) {
          currentScroll = previewPaneRef.scrollTop;
          lerpTicking = true;
          window.requestAnimationFrame(animateScroll);
        }
      }
    }
  });

  async function handleOpen() {
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'Documents',
        extensions: ['md', 'markdown', 'txt', 'pdf']
      }]
    });

    if (typeof selected === 'string') {
      try {
        if (selected.toLowerCase().endsWith('.pdf')) {
          const result = await invoke<number[]>("read_pdf_file", { path: selected });
          pdfData = new Uint8Array(result);
          isPdf = true;
          filePath = selected;
          isDirty = false;
          viewMode = 'reader';
        } else {
          const result = await invoke<string>("open_file", { path: selected });
          content = result;
          initialContent = result;
          filePath = selected;
          isDirty = false;
          isPdf = false;
          pdfData = null;
        }
      } catch (err) {
        console.error("Failed to open file:", err);
      }
    }
  }

  async function handleSaveAs() {
    const selected = await save({
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
    });
    if (typeof selected === 'string') {
      try {
        await invoke("save_file", { path: selected, content });
        filePath = selected;
        initialContent = content;
        isDirty = false;
      } catch (err) {
        console.error("Failed to save as:", err);
      }
    }
  }

  async function handleImportPdfText() {
    if (!pdfData) return;
    try {
      const extractedText = await extractTextFromPdf(pdfData);
      content = extractedText;
      isPdf = false;
      pdfData = null;
      isDirty = true;
      viewMode = 'split';
      filePath = filePath ? filePath.replace(/\.pdf$/i, '.md') : null;
    } catch (err) {
      console.error("Failed to extract text from PDF:", err);
    }
  }

  async function handleSave() {
    if (!filePath) {
      return handleSaveAs();
    }

    try {
      await invoke("save_file", { path: filePath, content });
      initialContent = content;
      isDirty = false;
    } catch (err) {
      console.error("Failed to save file:", err);
    }
  }

  function handleEditorScroll(line: number) {
    topVisibleLine = line;
  }
</script>

<main class="app-container">
  <header class="toolbar">
    <div class="actions">
      <button onclick={handleOpen}>Open</button>
      <button onclick={handleSave} disabled={!isDirty || isPdf}>Save</button>
      {#if isPdf}
        <button onclick={handleImportPdfText} style="background-color: #007acc; margin-left: 8px;">Import Text</button>
      {/if}
      
      <div class="view-mode-buttons" style={isPdf ? "display: none;" : "margin-left: 16px;"}>
        <button 
          class="icon-btn" class:active={viewMode === 'reader'}
          title="Reader" 
          onclick={() => viewMode = 'reader'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
        </button>
        <button 
          class="icon-btn" class:active={viewMode === 'split'}
          title="Preview/Edit" 
          onclick={() => viewMode = 'split'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="3" x2="12" y2="21"></line></svg>
        </button>
        <button 
          class="icon-btn" class:active={viewMode === 'editor'}
          title="Edit Only" 
          onclick={() => viewMode = 'editor'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
      </div>
    </div>
    <div class="status">
      <span>{filePath || "Untitled"} {isDirty ? "*" : ""}</span>
      <span>| Words: {wordCount}</span>
    </div>
  </header>

  <div class="workspace {viewMode}">
    {#if isPdf}
      <div class="preview-pane" style="padding: 0; background-color: transparent;">
        <PdfViewer {pdfData} />
      </div>
    {:else}
      {#if viewMode === 'reader' || viewMode === 'split'}
        <div class="preview-pane" class:focus-mode={viewMode === 'reader'} bind:this={previewPaneRef}>
          <div class="markdown-body">
            {@html htmlContent}
          </div>
        </div>
      {/if}

      {#if viewMode === 'editor' || viewMode === 'split'}
        <div class="editor-pane">
          <Editor bind:content onScroll={handleEditorScroll} />
        </div>
      {/if}
    {/if}
  </div>
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background-color: #1e1e1e;
    color: #d4d4d4;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  .app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
  }

  .toolbar {
    height: 40px;
    background-color: #252526;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    border-bottom: 1px solid #333;
    z-index: 10;
  }

  .actions {
    display: flex;
    align-items: center;
  }

  .actions button {
    background-color: #333;
    color: white;
    border: none;
    padding: 4px 12px;
    margin-right: 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }

  .view-mode-buttons {
    display: flex;
    background-color: #333;
    border-radius: 4px;
    overflow: hidden;
  }

  .actions .view-mode-buttons button.icon-btn {
    background-color: transparent;
    color: #aaa;
    margin: 0;
    border-radius: 0;
    padding: 6px 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-right: 1px solid #444;
  }

  .actions .view-mode-buttons button.icon-btn:last-child {
    border-right: none;
  }

  .actions .view-mode-buttons button.icon-btn:hover {
    background-color: #444;
    color: #fff;
  }

  .actions .view-mode-buttons button.icon-btn.active {
    background-color: #555;
    color: #fff;
  }

  .actions button:hover {
    background-color: #444;
  }

  .actions button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .status {
    font-size: 0.85em;
    color: #888;
  }

  .workspace {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .editor-pane {
    flex: 1;
    overflow: auto;
    background-color: #1e1e1e;
    border-left: 1px solid #333;
  }

  .preview-pane {
    flex: 1;
    overflow: auto;
    background-color: #fafafa;
    color: #333;
    padding: 24px 48px;
    position: relative;
    scroll-behavior: auto; /* Handled by Lerp */
  }

  .workspace.reader .preview-pane {
    background-color: #f5f5f5;
    padding: 0;
  }

  .workspace.reader :global(.markdown-body) {
    max-width: 720px;
    margin: 0 auto;
    padding: 64px 48px;
  }

  /* Make CM6 look decent in dark mode */
  :global(.cm-editor) {
    color: #d4d4d4 !important;
  }
  :global(.cm-content) {
    caret-color: #d4d4d4 !important;
  }
  :global(.cm-cursor, .cm-dropCursor) {
    border-left-color: #d4d4d4 !important;
  }
  :global(.cm-activeLine) {
    background-color: rgba(255, 255, 255, 0.05) !important;
  }

  /* Basic Markdown typography */
  :global(.markdown-body) {
    font-family: "Hiragino Sans", "Meiryo", "Yu Gothic", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    line-height: 1.8;
    word-wrap: break-word;
    /* Phase 4: Typography Optimization */
    text-rendering: optimizeLegibility;
    font-feature-settings: "palt";
  }
  
  :global(.markdown-body h1, .markdown-body h2, .markdown-body h3) {
    margin-top: 24px;
    margin-bottom: 16px;
    font-weight: 600;
    line-height: 1.25;
    color: #111;
  }
  :global(.markdown-body p) {
    margin-top: 0;
    margin-bottom: 16px;
    font-size: 1.05rem;
    color: #333;
  }
  :global(.markdown-body img) {
    max-width: 100%;
    border-radius: 4px;
  }
  
  :global(.markdown-body table) {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 16px;
  }
  :global(.markdown-body th),
  :global(.markdown-body td) {
    border: 1px solid #ddd;
    padding: 8px 12px;
    text-align: left;
  }
  :global(.markdown-body th) {
    background-color: #f6f8fa;
    font-weight: 600;
  }
  :global(.markdown-body tr:nth-child(even)) {
    background-color: #f8f9fa;
  }

  /* Reader Mode Styles */
  :global(.preview-pane.focus-mode .markdown-body > *) {
    transition: opacity 0.5s ease;
  }
</style>
