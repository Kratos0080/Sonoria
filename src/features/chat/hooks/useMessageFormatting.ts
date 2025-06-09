/* eslint-disable no-useless-escape */
import type { Message } from '../../../core/types/conversation';
import { useCallback } from 'react';
import markdownit from 'markdown-it';
// Import types directly from markdown-it
import type { Token, Options, Renderer } from 'markdown-it';
import hljs from 'highlight.js';

// Messages we don't want to show to the user
const SYSTEM_MESSAGE_PATTERNS = [
  "I'm going to ask you about this note",
  "Here's the full content to reference",
  "Based on your last response, please generate a brief, concise title"
];

/**
 * Hook providing utility functions for formatting and filtering messages
 */
export const useMessageFormatting = () => {
  const md: markdownit = markdownit({
    html: true,
    linkify: true,
    typographer: true,
    highlight: (str, lang) => {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
        } catch (__ ) {
          // Catch block cannot be empty - Ignored intentionally
        }
      }
      return ''; // use external default escaping
    }
  });

  /**
   * Filter out system messages and other hidden messages from the conversation
   */
  const filterSystemMessages = (messages: Message[]): Message[] => {
    // Special case for the first message if it's from assistant - hide initial summary
    if (messages.length > 0 && messages[0].role === 'assistant' && !messages[0].content.startsWith('Please ')) {
      // This is likely the initial summary message
      const filteredMsgs = [...messages];
      filteredMsgs.shift();
      return filterSystemMessages(filteredMsgs); // Continue filtering the rest
    }
    
    return messages.filter(msg => {
      // Check for system messages by comparing the role string
      // Type safety: Since our Message interface doesn't include 'system' as a valid role,
      // we need to compare as strings
      if ((msg.role as string) === 'system') return false;
      
      // Hide specific patterns from user and assistant messages
      for (const pattern of SYSTEM_MESSAGE_PATTERNS) {
        if (msg.content.includes(pattern)) return false;
      }
      
      return true;
    });
  };
  
  /**
   * Format markdown text as HTML
   */
  const formatMarkdown = (text: string): string => {
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
   * Process thinking sections in AI responses
   */
  const processThinkingSections = (content: string): string => {
    // Process <thinking> sections
    const thinkRegex = /<thinking>([\s\S]*?)<\/thinking>/g;
    const processed = content.replace(thinkRegex, (_match, thinkContent) => {
      return `<details class="notechat-thinking-section">
        <summary class="notechat-thinking-toggle">Thought process</summary>
        <div class="notechat-thinking-content">${thinkContent.trim()}</div>
      </details>\n\n`;
    });
    
    return processed;
  };
  
  /**
   * Extract title from message content (first line or first sentence)
   */
  const extractTitle = (content: string, maxLength: number = 50): string => {
    // Try to get the first line
    const firstLine = content.split('\n')[0].trim();
    
    // If the first line is short enough, use it
    if (firstLine.length <= maxLength && firstLine.length > 0) {
      return firstLine;
    }
    
    // Otherwise try to get the first sentence (up to a period)
    const firstSentenceMatch = content.match(/^[^.!?]+[.!?]/);
    if (firstSentenceMatch && firstSentenceMatch[0].length <= maxLength) {
      return firstSentenceMatch[0].trim();
    }
    
    // If both are too long, truncate the first line
    return firstLine.length > 0 
      ? `${firstLine.substring(0, maxLength - 3)}...` 
      : 'Untitled';
  };
  
  /**
   * Format a date for display in notes
   */
  const formatDateForDisplay = (): string => {
    const now = new Date();
    
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    };
    
    return now.toLocaleDateString(undefined, options);
  };
  
  /**
   * Format a date for use in filenames (safe format)
   */
  const formatDateForFilename = (date: Date | number): string => {
    const d = new Date(date);
    return d.toISOString()
      .replace(/[:.]/g, '-') // Replace colons and periods with hyphens
      .replace(/T/, '_')     // Replace T with underscore
      .replace(/Z$/, '');      // Remove trailing Z
  };
  
  const formatMessageContent = useCallback((text: string) => {
    let thinkingContent: string | null = null;
    const thinkRegex = /\u{1F9E0}([\s\S]*?)\u{1F9E0}/gu; // Thought emoji regex
    
    // Remove unused `match` parameter
    const processed = text.replace(thinkRegex, (/* match, */ thinkContentCapture) => {
      thinkingContent = thinkContentCapture.trim();
      return ''; // Remove the thinking block from the main content
    });

    const formattedContent = md.render(processed);

    return { formattedContent, thinkingContent };
  }, [md]);
  
  const highlightPlugin = () => {
    return {
      name: 'obsidian-code-block-highlight',
      // eslint-disable-next-line no-useless-escape
      rule: /^(```|~~~)(?:\s*([a-zA-Z0-9\-+_]+))?\s*\n([\s\S]*?)\n\1/gm,
      render: () => {
        // Implementation of the render function
        // Placeholder: Return empty string or basic preformatted block
        return '<pre><code>Highlighted Code Placeholder</code></pre>'; 
      }
    };
  };
  
  const formatSingleMessage = useCallback((message: Message) => {
    // Removed unused _languages
    return message.content; 
  }, []);

  // Configure fence rule with explicit types & prefixed unused params
  md.renderer.rules.fence = (tokens: Token[], idx: number, _options: Options, _env: Record<string, unknown>, _self: Renderer): string => {
    const token = tokens[idx];
    const info = token.info ? token.info.trim() : '';
    const content = token.content;

    if (info && hljs.getLanguage(info)) {
      try {
        const highlightedContent = hljs.highlight(content, { language: info, ignoreIllegals: true }).value;
        return `<pre class="hljs"><code>${highlightedContent}</code></pre>`;
      } catch (__) {
        // Ignore errors
      }
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(content)}</code></pre>`;
  };

  return {
    filterSystemMessages,
    formatMarkdown,
    processThinkingSections,
    extractTitle,
    formatDateForDisplay,
    formatDateForFilename,
    formatMessageContent,
    highlightPlugin,
    formatSingleMessage
  };
}; 