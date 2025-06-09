import * as React from 'react';
import { useState } from 'react';
import type { Message } from '../../../core/types/conversation';
import { formatDate } from '../../../utils/dateUtils';
import { sanitizeHtml } from '../../../utils/htmlUtils';

interface ChatMessageProps {
  message: Message;
  showTimestamp?: boolean;
  showAvatar?: boolean;
  onCopy?: (text: string) => void;
  onReply?: (message: Message) => void;
  onAction?: (action: string, message: Message) => void;
}

/**
 * Component for displaying a single chat message
 */
export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  showTimestamp = true,
  showAvatar = true,
  onCopy,
  onReply,
  onAction,
}) => {
  const [showActions, setShowActions] = useState(false);
  const isUser = message.role === 'user';
  const timestamp = message.timestamp ? formatDate(message.timestamp, 'short') : '';
  
  const handleCopy = () => {
    if (onCopy && message.content) {
      onCopy(message.content);
    }
  };
  
  const handleReply = () => {
    if (onReply) {
      onReply(message);
    }
  };
  
  return (
    <div 
      className={`chat-message ${isUser ? 'user-message' : 'assistant-message'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {showAvatar && (
        <div className="chat-avatar">
          {isUser ? (
            <div className="user-icon">👤</div>
          ) : (
            <div className="assistant-icon">🤖</div>
          )}
        </div>
      )}
      
      <div className="message-content-container">
        <div className="message-header">
          <span className="message-role">{isUser ? 'You' : 'Assistant'}</span>
          {showTimestamp && timestamp && (
            <span className="message-timestamp">{timestamp}</span>
          )}
        </div>
        
        <div 
          className="message-text"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.content || '') }}
        />
        
        <div className={`message-actions ${showActions ? 'visible' : ''}`}>
          <button 
            className="action-button copy-button" 
            onClick={handleCopy}
            title="Copy message"
          >
            📋
          </button>
          
          {!isUser && onReply && (
            <button 
              className="action-button reply-button" 
              onClick={handleReply}
              title="Reply to this message"
            >
              ↩️
            </button>
          )}
          
          {onAction && (
            <>
              {!isUser && (
                <button 
                  className="action-button save-button" 
                  onClick={() => onAction('save', message)}
                  title="Save as note"
                >
                  💾
                </button>
              )}
              {message.isHighlighted ? (
                <button 
                  className="action-button unhighlight-button" 
                  onClick={() => onAction('unhighlight', message)}
                  title="Remove highlight"
                >
                  ⭐
                </button>
              ) : (
                <button 
                  className="action-button highlight-button" 
                  onClick={() => onAction('highlight', message)}
                  title="Highlight message"
                >
                  ☆
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}; 