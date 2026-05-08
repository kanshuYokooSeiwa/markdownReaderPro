import * as pdfjsLib from 'pdfjs-dist';

// Ensure worker is configured
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).toString();
}

export async function extractTextFromPdf(data: Uint8Array): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({
    data,
    cMapUrl: '/cmaps/',
    cMapPacked: true,
  });

  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    let lastY = -1;
    let pageText = '';

    for (const item of textContent.items) {
      if ('str' in item) {
        const y = item.transform[5];
        const str = item.str;
        
        // Simple heuristic for line break
        if (lastY !== -1 && Math.abs(y - lastY) > 10) {
            pageText += '\n';
        }
        pageText += str;
        lastY = y;
      }
    }
    
    // Japanese layout heuristic: Remove soft line breaks between Japanese characters.
    // This regex looks for a Japanese character, a newline, and another Japanese character,
    // and removes the newline.
    // Hiragana: \u3040-\u309F, Katakana: \u30A0-\u30FF, Kanji: \u4E00-\u9FAF
    const jpSoftBreakRegex = /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF])\n([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF])/g;
    pageText = pageText.replace(jpSoftBreakRegex, '$1$2');
    // Run it twice in case of overlapping matches
    pageText = pageText.replace(jpSoftBreakRegex, '$1$2');
    
    fullText += `## Page ${pageNum}\n\n` + pageText + '\n\n';
  }

  return fullText.trim();
}
