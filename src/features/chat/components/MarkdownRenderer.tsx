import React, { useRef, useEffect } from 'react';
import { MarkdownRenderer as ObsidianRenderer, Component } from 'obsidian';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const render = async () => {
      if (!containerRef.current) return;
      
      // Clear previous content
      containerRef.current.innerHTML = '';
      
      // Use Obsidian's markdown renderer
      await ObsidianRenderer.renderMarkdown(
        content,
        containerRef.current,
        '', // sourcePath (empty string for dynamic content)
        new Component() // Pass dummy Component instance
      );
    };

    render();
  }, [content]);

  return <div ref={containerRef} className="notechat-markdown-content"></div>;
};

export default MarkdownRenderer; 