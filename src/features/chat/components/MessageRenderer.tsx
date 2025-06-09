import React, { useState } from 'react';
import { sanitizeHtml, markdownToHtml, extractCodeBlocks, containsMarkdown } from '../../../utils/htmlUtils';
// import { Message } from '../../../core/types/conversation'; // Removed unused import
// import { CodeBlockRenderer } from './CodeBlockRenderer'; // Removed unused import
// import { ThinkingBlock } from './ThinkingBlock'; // Removed unused import and related usage

interface MessageRendererProps {
  content: string;
  format?: 'plain' | 'html' | 'markdown';
  className?: string;
}

/**
 * Component for rendering message content with different formatting options
 */
export const MessageRenderer: React.FC<MessageRendererProps> = ({
  content,
  format = 'html',
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  if (!content) {
    return null;
  }
  
  // Auto-detect markdown if format is 'html'
  const effectiveFormat = format === 'html' && containsMarkdown(content) 
    ? 'markdown' 
    : format;
  
  // Determine if content is long enough to truncate
  const isLongMessage = content.length > 1000;
  
  // Extract code blocks if markdown
  const codeBlocks = effectiveFormat === 'markdown' ? extractCodeBlocks(content) : [];
  
  // Process content based on the specified format
  let processedContent = '';
  
  switch (effectiveFormat) {
    case 'plain':
      // Just escape HTML but don't add any formatting
      processedContent = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      break;
      
    case 'markdown':
      // Convert markdown to HTML, excluding code blocks
      processedContent = markdownToHtml(content);
      break;
      
    case 'html':
    default:
      // Basic HTML sanitization and formatting
      processedContent = sanitizeHtml(content);
      break;
  }
  
  // If message is long and collapsed, truncate it
  const displayContent = isLongMessage && !isExpanded 
    ? processedContent.substring(0, 500) + '...' 
    : processedContent;
  
  // Handle copying code blocks
  const handleCopyCode = (index: number, code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };
  
  return (
    <div className={`message-renderer ${className}`}>
      {/* Regular content */}
      <div 
        className="message-content"
        dangerouslySetInnerHTML={{ __html: displayContent }}
      />
      
      {/* Code blocks */}
      {effectiveFormat === 'markdown' && codeBlocks.map((block, index) => (
        <div key={index} className="code-block-container message-code-block">
          {block.language && (
            <div className="code-block-header">
              <span className="code-language">{block.language}</span>
              <button 
                className="copy-code-button" 
                onClick={() => handleCopyCode(index, block.code)}
                title="Copy code"
              >
                {copiedIndex === index ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}
          
          <pre className={`code-block ${block.language}`}>
            <code>{block.code}</code>
          </pre>
        </div>
      ))}
      
      {/* Show more/less button */}
      {isLongMessage && (
        <button 
          className="message-expand-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}; 