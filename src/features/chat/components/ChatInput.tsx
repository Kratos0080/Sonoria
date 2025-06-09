import * as React from 'react';
import { useEffect, useRef } from 'react';

export interface ChatInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSendViaEnter: () => void;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Component for chat message input with auto-resize.
 * Handles only the textarea element and its resizing.
 * Assumes parent component handles send button, prompts, etc.
 */
export function ChatInput({
  value,
  onChange,
  onSendViaEnter,
  isLoading = false,
  placeholder = 'Type a message...',
  disabled = false,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  
  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };
  
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.focus();
      resizeTextarea();
      window.addEventListener('resize', resizeTextarea);
      return () => {
        window.removeEventListener('resize', resizeTextarea);
      };
    }
    // Explicitly return undefined if no cleanup needed
    return undefined; 
  }, []);
  
  useEffect(() => {
    resizeTextarea();
  }, [value]);
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !disabled && !isLoading) {
      e.preventDefault();
      onSendViaEnter();
    }
  };
  
  return (
    <div className="message-input-container">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isLoading || disabled}
        rows={1}
        className="message-input"
        autoFocus
        style={{
          resize: 'none',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          width: '100%',
          padding: '10px',
          color: 'var(--text-normal)',
          fontFamily: 'inherit',
          fontSize: '15px',
          minHeight: '20px',
          maxHeight: '150px',
          overflow: 'auto'
        }}
      />
    </div>
  );
} 