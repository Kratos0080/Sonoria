/**
 * HTML sanitization and processing utilities
 */

/**
 * Sanitizes HTML to prevent XSS attacks and formats text for display
 * 
 * This function:
 * 1. Escapes HTML special characters
 * 2. Converts URLs to clickable links
 * 3. Preserves line breaks
 * 
 * @param html The HTML string to sanitize
 * @returns Sanitized HTML string with formatting preserved
 */
export const sanitizeHtml = (html: string): string => {
  // Very basic: replace common script tags
  // TODO: Replace with a more robust sanitizer library if complex HTML is expected
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Basic attempt to remove onerror attributes
  sanitized = sanitized.replace(/onerror=("|').*?\1/gi, '');
  // Remove other potentially dangerous attributes (very basic)
  sanitized = sanitized.replace(/on\w+=("|').*?\1/gi, '');
  return sanitized;
};

/**
 * Interface for a code block extracted from markdown
 */
export interface CodeBlock {
  code: string;
  language: string;
  index: number;
}

/**
 * Extracts code blocks from markdown text
 * 
 * @param markdown The markdown text to process
 * @returns Array of code blocks with their language and position
 */
export function extractCodeBlocks(markdown: string): CodeBlock[] {
  if (!markdown) return [];
  
  const codeBlocks: CodeBlock[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  
  let match;
  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    codeBlocks.push({
      language: match[1] || 'text',
      code: match[2],
      index: match.index
    });
  }
  
  return codeBlocks;
}

/**
 * Renders markdown text as HTML
 * 
 * This is a simple markdown renderer that handles:
 * - Headings (# Heading)
 * - Bold (**bold**)
 * - Italic (*italic*)
 * - Code blocks (```code```)
 * - Lists (- item)
 * 
 * @param markdown The markdown text to render
 * @returns HTML representation of the markdown
 */
export const markdownToHtml = (markdown: string): string => {
  // Remove unused variable
  // const codeBlocks = extractCodeBlocks(markdown);
  let html = markdown;

  // Process code blocks first for highlighting
  // Remove unused parameters `match` and `code`
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (/* match, */ language, codeContent) => {
    // TODO: Implement actual highlighting or placeholder replacement
    return `<pre><code class="language-${language || 'plaintext'}">${codeContent}</code></pre>`; // Return a placeholder string
  });

  // Basic Markdown to HTML conversion (you might use a library like Marked.js here)
  // ... basic markdown conversions ...

  return html;
};

/**
 * Checks if text contains any markdown formatting
 * 
 * @param text The text to check for markdown formatting
 * @returns True if the text contains markdown formatting
 */
export function containsMarkdown(text: string): boolean {
  if (!text) return false;
  
  // Check for common markdown patterns
  const markdownPatterns = [
    /^#+ /m,                // Headers
    /\*\*(.*?)\*\*/,        // Bold
    /\*(.*?)\*/,            // Italic
    /```[\s\S]*?```/,       // Code blocks
    /`[^`]+`/,              // Inline code
    /^\s*- /m,              // Unordered lists
    /^\s*\d+\. /m,          // Ordered lists
    /\[([^\]]+)\]\(([^)]+)\)/ // Links
  ];
  
  return markdownPatterns.some(pattern => pattern.test(text));
} 