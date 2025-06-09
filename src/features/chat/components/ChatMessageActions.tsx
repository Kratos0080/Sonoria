// import React from 'react'; // Removed unused import

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: number;
  isVisible?: boolean;
  context?: string[];
}

interface ChatMessageActionsProps {
  message: ChatMessage;
  onEdit?: () => void;
  onDelete?: () => void;
  onRegenerate?: () => void;
  onToggleVisibility?: () => void;
  onCopy?: () => void;
  isCopied?: boolean;
}

export function ChatMessageActions({
  message,
  onEdit,
  onDelete,
  onRegenerate,
  onToggleVisibility,
  onCopy,
  isCopied = false,
}: ChatMessageActionsProps) {
  return (
    <div className="message-actions">
      {onCopy && (
        <button 
          className="message-action copy-btn" 
          onClick={onCopy}
        >
          {isCopied ? 'Copied' : 'Copy'}
        </button>
      )}
      {onEdit && (
        <button className="message-action edit-btn" onClick={onEdit}>
          Edit
        </button>
      )}
      {message.sender === 'ai' && onRegenerate && (
        <button className="message-action regenerate-btn" onClick={onRegenerate}>
          Regenerate
        </button>
      )}
      {onDelete && (
        <button className="message-action delete-btn" onClick={onDelete}>
          Delete
        </button>
      )}
      {onToggleVisibility && (
        <button 
          className="message-action visibility-btn" 
          onClick={onToggleVisibility}
        >
          {message.isVisible ? 'Hide' : 'Show'}
        </button>
      )}
    </div>
  );
} 