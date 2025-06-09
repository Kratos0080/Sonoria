/** 
 * Utility functions and type definitions for working with React in Obsidian
 * 
 * Obsidian uses an older version of React, and there are some compatibility issues.
 * This file provides utility functions and type definitions to work around these issues.
 */

/* eslint-disable no-useless-escape */

import type * as React from 'react';
import type { Message } from '../core/types/conversation';

// Counter used for generating unique keys
let uniqueKeyCounter = 0;

/**
 * Format markdown content to HTML
 * @param text Markdown text to format
 * @returns Formatted HTML
 */
export function formatMarkdown(text: string): string {
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
}

/**
 * Filter messages to hide system messages from the user
 * @param msgs Array of messages to filter
 * @returns Filtered messages array
 */
export function filterSystemMessages(msgs: Message[]): Message[] {
  // Special case for the first message if it's from assistant - hide initial summary
  if (msgs.length > 0 && msgs[0].role === 'assistant' && !msgs[0].content.startsWith('Please ')) {
    // This is likely the initial summary message
    const filteredMsgs = [...msgs];
    filteredMsgs.shift();
    return filterSystemMessages(filteredMsgs); // Continue filtering the rest
  }
  
  // System message patterns to hide
  const SYSTEM_MESSAGE_PATTERNS = [
    "I'm going to ask you about this note",
    "Here's the full content to reference",
    "Based on your last response, please generate a brief, concise title"
  ];
  
  return msgs.filter(msg => {
    // Check for system messages
    if ((msg.role as string) === 'system') return false;
    
    // Hide specific patterns
    for (const pattern of SYSTEM_MESSAGE_PATTERNS) {
      if (msg.content.includes(pattern)) return false;
    }
    
    return true;
  });
}

/**
 * Format a date for display in notes
 */
export function formatDateForDisplay(): string {
  const now = new Date();
  return now.toLocaleString();
}

/**
 * Format a date for use in filenames (safe format)
 */
export function formatDateForFilename(): string {
  const now = new Date();
  return now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
}

/**
 * Wraps a React FC component to make it compatible with JSX rendering
 * in our implementation
 */
export function wrapReactComponent<P>(Component: React.FC<P>) {
  return function WrappedComponent(props: P) {
    return Component(props);
  };
}

/**
 * Generate a unique key for a React element, useful for lists without stable IDs
 * @param prefix Optional prefix for the key
 */
export function generateUniqueKey(prefix = 'key'): string {
  // Simple counter based key generation - potentially use UUID or nanoid for more robustness
  const key = `${prefix}-${uniqueKeyCounter++}`;
  return key;
}

/**
 * Escape special characters in a string for use in regular expressions
 */
export const escapeRegExp = (str: string): string => {
  // Escape characters with special meaning in regex
  // eslint-disable-next-line no-useless-escape
  return str.replace(/[.*+?^${}()|[\\]\/]/g, '\\$&');
};

/**
 * @param className - The base class name.
 * @returns A function that takes an element name and returns the full class name.
 */
export const createBemClass = (className: string) => (
  element?: string,
  modifier?: string | Record<string, boolean> | (string | undefined)[]
): string => {
  let finalClass = element ? `${className}__${element}` : className;

  if (modifier) {
    if (typeof modifier === 'string') {
      finalClass += ` ${finalClass}--${modifier}`;
    } else if (Array.isArray(modifier)) {
      modifier.forEach(mod => {
        if (mod) {
          finalClass += ` ${finalClass}--${mod}`;
        }
      });
    } else {
      Object.keys(modifier).forEach(modKey => {
        if (modifier[modKey]) {
          // Ensure modifier key is valid (e.g., no spaces, starts alphanumeric)
          if (/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(modKey)) { 
            finalClass += ` ${finalClass}--${modKey}`;
          } else {
            console.warn(`Invalid BEM modifier key: ${modKey}`);
          }
        }
      });
    }
  }

  return finalClass;
}; 