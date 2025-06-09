import React, { useState } from 'react';

interface CodeBlockRendererProps {
  code: string;
  language?: string;
  className?: string;
}

/**
 * Component for rendering code blocks with syntax highlighting
 */
export const CodeBlockRenderer: React.FC<CodeBlockRendererProps> = ({
  code,
  language = '',
  className = '',
}) => {
  const [isCopied, setIsCopied] = useState(false);
  
  if (!code) return null;
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };
  
  return (
    <div className={`code-block-container ${className}`}>
      {language && (
        <div className="code-block-header">
          <span className="code-language">{language}</span>
          <button 
            className="copy-code-button" 
            onClick={handleCopy}
            title="Copy code"
          >
            {isCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
      
      <pre className={`code-block ${language}`}>
        <code>{code}</code>
      </pre>
    </div>
  );
}; 