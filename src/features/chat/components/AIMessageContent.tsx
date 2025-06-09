import React, { useState, useEffect, useRef } from 'react';
import { markdownToHtml } from '../../../utils/markdown';

// Define the ChatMessage interface locally if the import is causing issues
interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: number;
  isVisible?: boolean;
  context?: string[];
}

interface AIMessageContentProps {
  message: ChatMessage;
}

// Function to find and process the thinking part of the content
const processContentWithThinking = (content: string) => {
  const thinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/;
  const match = content.match(thinkingRegex);
  
  if (match) {
    const thinking = match[1].trim();
    const rest = content.replace(thinkingRegex, '').trim();
    
    return {
      hasThinking: true,
      parts: [
        { type: 'text', content: rest },
        { type: 'thinking', content: thinking }
      ]
    };
  }
  
  // No thinking part found, return entire content as text
  return {
    hasThinking: false,
    parts: [{ type: 'text', content }]
  };
};

// Component for rendering a Thinking section
function ThinkingSection({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className="thinking-section">
      <button 
        className="thinking-toggle" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <span>
            <svg viewBox="0 0 100 100" className="right-triangle">
              <path fill="currentColor" stroke="currentColor" d="M94.9,20.8c-1.4-2.5-4.1-4.1-7.1-4.1H12.2c-3,0-5.7,1.6-7.1,4.1c-1.3,2.4-1.2,5.2,0.2,7.6L43.1,88c1.5,2.3,4,3.7,6.9,3.7 s5.4-1.4,6.9-3.7l37.8-59.6C96.1,26,96.2,23.2,94.9,20.8z"></path>
            </svg> Hide thinking
          </span>
        ) : (
          <span>
            <svg viewBox="0 0 100 100" className="right-triangle">
              <path fill="currentColor" stroke="currentColor" d="M12.2,75.4h75.6c3,0,5.7-1.6,7.1-4.1c1.3-2.4,1.2-5.2-0.2-7.6L56.9,4.1c-1.5-2.3-4-3.7-6.9-3.7s-5.4,1.4-6.9,3.7L5.3,63.7 c-1.4,2.4-1.5,5.2-0.2,7.6C6.5,73.8,9.2,75.4,12.2,75.4z"></path>
            </svg> Show thinking
          </span>
        )}
      </button>
      {isExpanded && (
        <div className="thinking-content">
          <div 
            className="markdown-rendered" 
            dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }}
          />
        </div>
      )}
    </div>
  );
}

// Component for rendering regular markdown content
function MarkdownContent({ content }: { content: string }) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  
  // Process the content to ensure code blocks are properly formatted
  useEffect(() => {
    if (contentRef.current) {
      // Add click event to copy code buttons if they exist
      const codeBlocks = contentRef.current.querySelectorAll('pre code');
      
      codeBlocks.forEach((codeBlock) => {
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-code-button';
        copyButton.textContent = 'Copy';
        copyButton.onclick = () => {
          const code = codeBlock.textContent || '';
          navigator.clipboard.writeText(code)
            .then(() => {
              copyButton.textContent = 'Copied!';
              setTimeout(() => {
                copyButton.textContent = 'Copy';
              }, 2000);
            })
            .catch(err => {
              console.error('Failed to copy code:', err);
            });
        };
        
        // Add the button to the code block's parent
        const preElement = codeBlock.parentElement;
        if (preElement && !preElement.querySelector('.copy-code-button')) {
          preElement.style.position = 'relative';
          preElement.appendChild(copyButton);
        }
      });
    }
  }, [content]);
  
  return (
    <div 
      ref={contentRef}
      className="markdown-rendered markdown-content obsidian-markdown" 
      dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }}
    />
  );
}

export const AIMessageContent: React.FC<AIMessageContentProps> = ({ message }) => {
  const content = message.content || '';
  const { parts } = processContentWithThinking(content);
  
  return (
    <div className="ai-message-content">
      {parts.map((part, index) => (
        part.type === 'thinking' ? 
          <ThinkingSection key={`thinking-${index}`} content={part.content} /> : 
          <MarkdownContent key={`text-${index}`} content={part.content} />
      ))}
    </div>
  );
}; 