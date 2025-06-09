/**
 * Format markdown text to HTML with basic styling
 */

/* eslint-disable no-useless-escape */

export const formatMarkdown = (text: string): string => {
  // Basic markdown formatting
  const formatted = text
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Headers (h1, h2, h3)
    .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
    // Lists
    .replace(/^\- (.*?)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.*?)$/gm, '<li>$1</li>')
    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // Inline code
    .replace(/`(.*?)`/g, '<code>$1</code>')
    // Line breaks
    .replace(/\n/g, '<br />');
  
  return formatted;
};

/**
 * Format text as a Markdown code block
 */
export const formatCodeBlock = (code: string, language = ''): string => {
  // Trim leading/trailing whitespace and ensure consistent newlines
  const trimmedCode = code.trim().replace(/\r\n/g, '\n');
  
  // Add fences
  return `\`\`\`${language}\n${trimmedCode}\n\`\`\``;
};

/**
 * Convert text to title case (e.g., "hello world" -> "Hello World")
 */
export const toTitleCase = (str: string): string => {
  // Remove unnecessary escape in character class
  // The regex should match word characters followed by non-whitespace characters
  return str.replace(/\w\S*/g, (txt) => { 
    return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase();
  });
};

/**
 * Sanitize text to be used as a filename.
 *
 * @param text The text to sanitize.
 * @returns The sanitized text suitable for use as a filename.
 */
export function sanitizeFilename(text: string): string {
  // Remove characters not suitable for filenames and replace spaces
  // eslint-disable-next-line no-useless-escape
  const sanitized = text.replace(/[^a-zA-Z0-9\-_.]+/g, '_').replace(/\s+/g, '_');
  // Limit length to avoid issues with file systems
  return sanitized.substring(0, 100);
} 