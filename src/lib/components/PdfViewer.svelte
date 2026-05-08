<script lang="ts">
  import * as pdfjsLib from 'pdfjs-dist';

  let { pdfData } = $props<{ pdfData: Uint8Array | null }>();
  let canvasContainer = $state<HTMLDivElement | null>(null);

  // Configure worker once
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).toString();

  $effect(() => {
    if (!pdfData || !canvasContainer) return;

    let isCancelled = false;

    let observer: IntersectionObserver;

    async function initPdf(data: Uint8Array) {
      if (!canvasContainer) return;
      canvasContainer.innerHTML = ''; // Clear existing pages
      
      const loadingTask = pdfjsLib.getDocument({
        data,
        cMapUrl: '/cmaps/',
        cMapPacked: true,
      });

      const pdf = await loadingTask.promise;
      if (isCancelled) return;

      const numPages = pdf.numPages;

      observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const wrapper = entry.target as HTMLDivElement;
            const pageNum = parseInt(wrapper.dataset.page || '1', 10);
            if (!wrapper.dataset.rendered) {
              wrapper.dataset.rendered = 'true';
              renderPage(pdf, pageNum, wrapper).catch(console.error);
            }
          }
        });
      }, { root: canvasContainer, rootMargin: '200px' });

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        if (isCancelled) break;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'pdf-page-wrapper';
        wrapper.dataset.page = pageNum.toString();
        // A placeholder height to allow scrolling before rendering
        wrapper.style.minHeight = '800px'; 
        wrapper.style.width = '100%';
        wrapper.style.display = 'flex';
        wrapper.style.justifyContent = 'center';

        canvasContainer.appendChild(wrapper);
        observer.observe(wrapper);
      }
    }

    async function renderPage(pdf: any, pageNum: number, wrapper: HTMLDivElement) {
      if (isCancelled) return;
      const page = await pdf.getPage(pageNum);
      const scale = 1.5;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      wrapper.style.minHeight = 'auto'; // Remove placeholder height
      wrapper.appendChild(canvas);

      const renderContext = {
        canvasContext: context!,
        viewport: viewport
      };
      await page.render(renderContext).promise;
    }

    initPdf(pdfData).catch(console.error);

    return () => {
      isCancelled = true;
      if (observer) observer.disconnect();
    };
  });
</script>

<div class="pdf-viewer" bind:this={canvasContainer}></div>

<style>
  .pdf-viewer {
    display: flex;
    flex-direction: column;
    align-items: center;
    background-color: #525659;
    padding: 20px;
    overflow-y: auto;
    height: 100%;
    width: 100%;
    box-sizing: border-box;
  }
  :global(.pdf-page-wrapper) {
    margin-bottom: 20px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    background-color: white;
  }
</style>
