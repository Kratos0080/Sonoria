// import * as React from 'react'; // Removed unused import
// import { useState, useEffect } from 'react';
import { MessageList } from './MessageList';
import type { Message } from '../../../core/types/conversation';

interface ChatMessageAreaProps {
  messages: Message[];
  isLoading: boolean;
  loadingMessage?: string | null;
  className?: string;
  streamingMessage?: Message | null;
  isStreaming?: boolean;
}

/**
 * Component that handles the display of chat messages and empty state
 */
function ChatMessageArea({
  messages = [],
  isLoading,
  loadingMessage = '', // Just show dots without text
  className = '',
  streamingMessage = null,
  isStreaming = false,
}: ChatMessageAreaProps) {
  /**
   * Renders the empty state when no messages are present
   */
  const renderEmptyState = () => (
    <div className="notechat-empty-state">
      <div className="notechat-empty-icon"></div>
                  <h3>👋 Welcome to Sonoria!</h3>
      <p>Type a message, hold the mic, or tap ▶️ to hear replies—I&apos;ll search your selected notes and answer back in real time. Open the Context panel, switch modes, and let your vault talk. Say hi and watch ideas come alive! 🚀</p>
    </div>
  );

  return (
    <div className={`notechat-messages-container ${className}`}>
      {messages.length === 0 && !isStreaming ? (
        renderEmptyState()
      ) : (
        <MessageList 
          messages={messages}
          isLoading={isLoading}
          loadingMessage={loadingMessage || ''} // Just show dots without text
          streamingMessage={streamingMessage}
          isStreaming={isStreaming}
        />
      )}
    </div>
  );
}

export default ChatMessageArea; 