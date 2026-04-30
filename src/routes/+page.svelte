<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { open } from "@tauri-apps/plugin-dialog";
  import Editor from "$lib/components/Editor.svelte";
  import { processMarkdown } from "$lib/markdown";

  let content = $state("");
  let filePath = $state<string | null>(null);
  let isDirty = $state(false);
  let viewMode = $state<"editor" | "reader" | "split">("split");
  let htmlContent = $state("");

  let wordCount = $derived(content.trim().split(/\s+/).filter(w => w.length > 0).length);

  let initialContent = "";
  
  // Sync-Scroll State
  let topVisibleLine = $state(1);
  let previewPaneRef = $state<HTMLDivElement | null>(null);
  let activeElement = $state<HTMLElement | null>(null);

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
        name: 'Markdown',
        extensions: ['md', 'markdown', 'txt']
      }]
    });

    if (typeof selected === 'string') {
      try {
        const result = await invoke<string>("open_file", { path: selected });
        content = result;
        initialContent = result;
        filePath = selected;
        isDirty = false;
      } catch (err) {
        console.error("Failed to open file:", err);
      }
    }
  }

  async function handleSave() {
    if (!filePath) return;

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
      <button onclick={handleSave} disabled={!isDirty || !filePath}>Save</button>
      
      <select bind:value={viewMode} class="view-mode-select">
        <option value="editor">Editor Only</option>
        <option value="split">Split View</option>
        <option value="reader">Reader Mode (Zen)</option>
      </select>
    </div>
    <div class="status">
      <span>{filePath || "Untitled"} {isDirty ? "*" : ""}</span>
      <span>| Words: {wordCount}</span>
    </div>
  </header>

  <div class="workspace {viewMode}">
    {#if viewMode === 'editor' || viewMode === 'split'}
      <div class="editor-pane">
        <Editor bind:content onScroll={handleEditorScroll} />
      </div>
    {/if}
    
    {#if viewMode === 'reader' || viewMode === 'split'}
      <div class="preview-pane markdown-body" class:focus-mode={viewMode === 'reader'} bind:this={previewPaneRef}>
        {@html htmlContent}
      </div>
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

  .actions button, .view-mode-select {
    background-color: #333;
    color: white;
    border: none;
    padding: 4px 12px;
    margin-right: 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }

  .view-mode-select {
    outline: none;
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
    border-right: 1px solid #333;
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
  }

  .workspace.reader :global(.markdown-body) {
    max-width: 720px;
    margin: 0 auto;
    padding: 40px 0;
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

  /* Reader Mode (Focus Mode) Styles */
  :global(.preview-pane.focus-mode .markdown-body > *) {
    transition: opacity 0.5s ease;
    opacity: 0.25;
  }
  
  :global(.preview-pane.focus-mode .markdown-body > .active-paragraph) {
    opacity: 1;
  }
</style>
