/**
 * Text processing utilities for NoteChat
 * Includes word counting, text truncation, and message processing functions
 */

/**
 * Counts words in a given text string
 * Handles various text formats including markdown
 * 
 * @param text The text to count words from
 * @returns Number of words in the text
 */
export function countWords(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  // Remove markdown syntax for more accurate word counting
  const cleanText = text
    // Remove code blocks (```...```)
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code (`...`)
    .replace(/`[^`]+`/g, '')
    // Remove markdown headers (# ## ###)
    .replace(/^#+\s+/gm, '')
    // Remove markdown emphasis (**bold**, *italic*)
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Remove markdown links [text](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Replace multiple whitespace with single space
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanText) {
    return 0;
  }

  // Handle both Western (space-separated) and CJK (Chinese/Japanese/Korean) text
  // For CJK languages, count characters as approximate words since they don't use spaces
  const cjkRegex = /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff]/;
  const hasCJKText = cjkRegex.test(cleanText);
  
  if (hasCJKText) {
    // For mixed or primarily CJK text, count characters and approximate words
    const cjkChars = cleanText.match(/[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff]/g) || [];
    const westernWords = cleanText.replace(/[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff]/g, ' ')
      .split(/\s+/).filter(word => word.length > 0);
    
    // Approximate: 1.5 CJK characters ≈ 1 word (since CJK characters carry more meaning)
    return Math.ceil(cjkChars.length / 1.5) + westernWords.length;
  } else {
    // For Western text, split by whitespace
    const words = cleanText.split(/\s+/).filter(word => word.length > 0);
    return words.length;
  }
}

/**
 * Checks if a message should be collapsible based on word count
 * 
 * @param content The message content to check
 * @param threshold The word count threshold (default: 30)
 * @returns True if the message should be collapsible
 */
export function shouldMessageBeCollapsible(content: string, threshold: number = 30): boolean {
  return countWords(content) > threshold;
}

/**
 * Truncates text to a specified word count while preserving word boundaries
 * 
 * @param text The text to truncate
 * @param wordLimit The maximum number of words to include
 * @param suffix The suffix to add when text is truncated (default: '...')
 * @returns Truncated text with suffix if applicable
 */
export function truncateToWords(text: string, wordLimit: number, suffix: string = '...'): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const words = text.split(/\s+/);
  
  if (words.length <= wordLimit) {
    return text;
  }

  const truncated = words.slice(0, wordLimit).join(' ');
  return truncated + suffix;
}

/**
 * Estimates reading time in minutes based on word count
 * Assumes average reading speed of 200 words per minute
 * 
 * @param text The text to estimate reading time for
 * @returns Estimated reading time in minutes (minimum 1)
 */
export function estimateReadingTime(text: string): number {
  const wordCount = countWords(text);
  const wordsPerMinute = 200;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  return Math.max(1, minutes);
}

/**
 * Extracts the first sentence or meaningful preview from text
 * Useful for showing a preview of collapsed content
 * 
 * @param text The text to extract preview from
 * @param maxLength Maximum character length of preview (default: 100)
 * @returns Preview text
 */
export function extractTextPreview(text: string, maxLength: number = 100): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Clean the text first
  const cleanText = text
    .replace(/```[\s\S]*?```/g, '[code block]')
    .replace(/`[^`]+`/g, '[code]')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanText.length <= maxLength) {
    return cleanText;
  }

  // Try to break at sentence boundary
  const sentences = cleanText.split(/[.!?]+/);
  if (sentences.length > 1 && sentences[0].length <= maxLength) {
    return sentences[0].trim() + '.';
  }

  // Fallback to character limit at word boundary
  const truncated = cleanText.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

/**
 * Removes OpenAI Assistant API citation annotations from text
 * Citations appear as 【FileID:ChunkID†source】 in responses when using File Search
 * 
 * @param text The text containing potential citation annotations
 * @returns Clean text with citation annotations removed
 * 
 * @example
 * // Input: "This is useful information【4:0†source】【4:11†source】."
 * // Output: "This is useful information."
 */
export function removeCitationAnnotations(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  // Regex to match citation patterns like 【4:0†filename.md】, 【11:25†《中文文件》.md】, etc.
  // Pattern breakdown:
  // 【 - Opening bracket (Unicode U+3010)
  // \d+ - One or more digits (FileID)
  // : - Colon separator
  // \d+ - One or more digits (ChunkID)  
  // † - Dagger character
  // [^】]+ - One or more characters that are NOT the closing bracket (captures any filename including Chinese)
  // 】 - Closing bracket (Unicode U+3011)
  // g - Global flag to replace all occurrences
  const citationPattern = /【\d+:\d+†[^】]+】/g;
  
  return text.replace(citationPattern, '');
}

/**
 * Interface for collapsible message metadata
 */
export interface CollapsibleMessageInfo {
  shouldCollapse: boolean;
  wordCount: number;
  estimatedReadingTime: number;
  preview: string;
  truncatedContent: string;
}

/**
 * Analyzes message content and returns collapsible message information
 * 
 * @param content The message content to analyze
 * @param options Configuration options
 * @returns Complete analysis of the message for collapsible display
 */
export function analyzeMessageContent(
  content: string, 
  options: {
    wordThreshold?: number;
    previewLength?: number;
    truncateWords?: number;
  } = {}
): CollapsibleMessageInfo {
  const {
    wordThreshold = 30,
    previewLength = 100,
    truncateWords = 25
  } = options;

  const wordCount = countWords(content);
  const shouldCollapse = wordCount > wordThreshold;
  
  return {
    shouldCollapse,
    wordCount,
    estimatedReadingTime: estimateReadingTime(content),
    preview: extractTextPreview(content, previewLength),
    truncatedContent: truncateToWords(content, truncateWords)
  };
} 