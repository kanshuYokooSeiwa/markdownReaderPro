<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EditorView, basicSetup } from 'codemirror';
  import { markdown } from '@codemirror/lang-markdown';
  import { EditorState } from '@codemirror/state';

  let { content = $bindable(), onScroll } = $props<{
    content: string,
    onScroll?: (topLine: number) => void
  }>();

  let editorContainer: HTMLDivElement;
  let view: EditorView;
  let isComposing = false;
  let scrollHandler: () => void;

  onMount(() => {
    let state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        markdown(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isComposing) {
            content = update.state.doc.toString();
          }
        }),
        EditorView.domEventHandlers({
          compositionstart: () => {
            isComposing = true;
          },
          compositionend: (event, view) => {
            isComposing = false;
            content = view.state.doc.toString();
          }
        })
      ]
    });

    view = new EditorView({
      state,
      parent: editorContainer
    });

    let scrollTicking = false;
    scrollHandler = () => {
      if (!scrollTicking && onScroll) {
        window.requestAnimationFrame(() => {
          const scrollTop = view.scrollDOM.scrollTop;
          const blockInfo = view.lineBlockAtHeight(scrollTop);
          const line = view.state.doc.lineAt(blockInfo.from);
          onScroll(line.number);
          scrollTicking = false;
        });
        scrollTicking = true;
      }
    };
    view.scrollDOM.addEventListener('scroll', scrollHandler);
  });

  onDestroy(() => {
    if (view) {
      if (scrollHandler) {
        view.scrollDOM.removeEventListener('scroll', scrollHandler);
      }
      view.destroy();
    }
  });

  $effect(() => {
    if (view && content !== view.state.doc.toString() && !isComposing) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: content
        }
      });
    }
  });
</script>

<div class="editor-container" bind:this={editorContainer}></div>

<style>
  .editor-container {
    height: 100%;
    width: 100%;
    text-align: left;
    font-family: 'Hiragino Sans', 'Meiryo', 'Yu Gothic', sans-serif;
    line-height: 1.6;
  }
  
  :global(.cm-editor) {
    height: 100%;
  }
</style>
