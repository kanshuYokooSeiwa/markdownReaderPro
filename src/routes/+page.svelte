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
    if (!filePath) {
      return;
    }

    try {
      await invoke("save_file", { path: filePath, content });
      initialContent = content;
      isDirty = false;
    } catch (err) {
      console.error("Failed to save file:", err);
    }
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
        <option value="reader">Reader Only</option>
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
        <Editor bind:content />
      </div>
    {/if}
    
    {#if viewMode === 'reader' || viewMode === 'split'}
      <div class="preview-pane markdown-body">
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
    padding: 24px 32px;
  }

  .workspace.reader .preview-pane {
    max-width: 800px;
    margin: 0 auto;
    border-left: 1px solid #ddd;
    border-right: 1px solid #ddd;
  }

  /* Make CM6 look decent in dark mode out of the box */
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

  /* Basic Markdown styling */
  :global(.markdown-body) {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    line-height: 1.6;
    word-wrap: break-word;
  }
  :global(.markdown-body h1, .markdown-body h2, .markdown-body h3) {
    margin-top: 24px;
    margin-bottom: 16px;
    font-weight: 600;
    line-height: 1.25;
  }
  :global(.markdown-body p) {
    margin-top: 0;
    margin-bottom: 16px;
  }
  :global(.markdown-body img) {
    max-width: 100%;
    box-sizing: content-box;
  }
</style>
