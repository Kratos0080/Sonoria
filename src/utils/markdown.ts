import { marked } from 'marked';
import hljs from 'highlight.js';

/**
 * Configure marked options for safe and proper rendering
 */
marked.setOptions({
  renderer: new marked.Renderer(),
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch (err) {
        console.error('Error highlighting code:', err);
      }
    }
    return code;
  },
  pedantic: false,
  gfm: true,
  breaks: true,
  sanitize: false,
  smartypants: true,
  xhtml: false
});

// Custom renderer to handle Obsidian-specific syntax
const renderer = new marked.Renderer();

// Handle internal links better
renderer.link = (href, title, text) => {
  // Check if this is an Obsidian internal link
  const isObsidianLink = href?.startsWith('obsidian://');
  
  if (isObsidianLink) {
    return `<a class="internal-link" href="${href}" ${title ? `title="${title}"` : ''}>${text}</a>`;
  }
  
  // External links open in new tab with security attributes
  return `<a href="${href}" target="_blank" rel="noopener noreferrer" ${title ? `title="${title}"` : ''}>${text}</a>`;
};

// Enhance code blocks
renderer.code = (code, language) => {
  language = language || '';
  
  // Add copy button to code blocks
  return `
    <div class="code-block-wrapper">
      <pre><code class="language-${language}">${
        language && hljs.getLanguage(language) 
          ? hljs.highlight(code, { language }).value 
          : escapeHtml(code)
      }</code></pre>
      <button class="copy-code-button" onclick="navigator.clipboard.writeText(\`${code.replace(/`/g, '\\`')}\`)">
        Copy
      </button>
    </div>
  `;
};

marked.use({ renderer });

/**
 * Convert markdown to HTML
 * @param content - Markdown content to convert
 * @returns HTML string
 */
export function markdownToHtml(content: string): string {
  if (!content) return '';
  
  try {
    // Process Obsidian-specific syntax
    const processedContent = processObsidianSyntax(content);
    return marked(processedContent);
  } catch (error) {
    console.error('Error converting markdown to HTML:', error);
    // Return escaped content as fallback
    return escapeHtml(content);
  }
}

/**
 * Process Obsidian-specific markdown syntax
 */
function processObsidianSyntax(content: string): string {
  // Handle [[internal links]]
  content = content.replace(/\[\[(.*?)\]\]/g, (/* match, */ p1) => {
    // Extract display text if present (e.g., [[Link|Display Text]])
    const parts = p1.split('|');
    return parts.length > 1 ? parts[1] : parts[0];
  });

  // Handle ![[embedded files]]
  content = content.replace(/!\[\[(.*?)\]\]/g, (/* match, */ p1) => {
    if (p1.endsWith('.png') || p1.endsWith('.jpg') || p1.endsWith('.jpeg') || p1.endsWith('.gif') || p1.endsWith('.svg')) {
      return `![${p1}](obsidian://open?vault=${encodeURIComponent('vault')}&file=${encodeURIComponent(p1)})`;
    }
    return `<div class="embedded-note">${p1}</div>`;
  });

  return content;
}

/**
 * Escape HTML special characters to prevent XSS
 * @param unsafe - Unsafe string
 * @returns Escaped string
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function parseWikiLinks(content: string): string {
  // Replace [[WikiLinks]] with plain text
  content = content.replace(/\[\[(.*?)\]\]/g, (/* match, */ p1) => {
    // Extract display text if present (e.g., [[Link|Display Text]])
    const parts = p1.split('|');
    return parts.length > 1 ? parts[1] : parts[0];
  });

  // Remove embedded links ![[]]
  content = content.replace(/!\[\[(.*?)\]\]/g, (/* match, p1 */) => {
    // Return empty string to remove the embed link
    return ''; 
  });

  return content;
} 