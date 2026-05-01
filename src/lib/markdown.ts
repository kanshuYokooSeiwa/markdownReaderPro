import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Node } from 'unist';
import { VFile } from 'vfile';

const remarkLineNumber: Plugin = () => {
  return (tree: Node) => {
    visit(tree, (node: any) => {
      if (node.position && node.position.start) {
        node.data = node.data || {};
        node.data.hProperties = node.data.hProperties || {};
        node.data.hProperties['data-line'] = node.position.start.line;
      }
    });
  };
};

const rehypeAssetProtocol: Plugin = () => {
  return (tree: Node, file: VFile) => {
    // Basic base path resolution
    const basePath = file.path ? file.path.replace(/[^/\\]+$/, '') : '';
    
    visit(tree, 'element', (node: any) => {
      if (node.tagName === 'img' && node.properties && typeof node.properties.src === 'string') {
        const src = node.properties.src;
        if (!src.match(/^(https?:\/\/|data:)/)) {
          let absPath = src;
          // Extremely basic relative path handling
          if (!src.startsWith('/') && !src.match(/^[a-zA-Z]:[/\\]/)) {
            // Check if we have a base path
            if (basePath) {
               absPath = basePath + src;
            }
          }
          // Tauri custom protocol format: schema://host/path
          // Here we use `kuro-asset://localhost/` + path
          node.properties.src = `kuro-asset://localhost/${encodeURIComponent(absPath)}`;
        }
      }
    });
  };
};

export const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkLineNumber)
  .use(remarkRehype)
  .use(rehypeAssetProtocol)
  .use(rehypeStringify);

export async function processMarkdown(content: string, filePath?: string | null): Promise<string> {
  const file = new VFile({ value: content, path: filePath || undefined });
  const result = await markdownProcessor.process(file);
  return result.toString();
}
