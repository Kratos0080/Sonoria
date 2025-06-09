import React, { useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import type { Message } from '../../../core/types/conversation';
import { formatDate } from '../../../utils/dateUtils';
import { sanitizeHtml } from '../../../utils/htmlUtils';
import { CollapsibleMessage } from './CollapsibleMessage';
import { useVoiceModeCheck } from '../context/VoiceModeContext';
import { useTTSPlayback } from '../hooks/useTTSPlayback';
import { Copy, AudioLines, Pause, Loader, AlertTriangle } from 'lucide-react';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  className?: string;
  loadingMessage?: string;
  streamingMessage?: Message | null;
  isStreaming?: boolean;
  /** Enable collapsible messages for AI responses (default: true) */
  enableCollapsibleMessages?: boolean;
  /** Word threshold for collapsible messages (default: 30) */
  collapsibleWordThreshold?: number;
}

/**
 * Component for displaying AI messages with TTS playback controls
 */
interface AIMessageProps {
  message: Message;
  isStreamingMsg: boolean;
  shouldUseCollapsible: boolean;
  effectiveWordThreshold: number;
}

const AIMessage: React.FC<AIMessageProps> = observer(({
  message,
  isStreamingMsg,
  shouldUseCollapsible,
  effectiveWordThreshold,
}) => {
  const timestamp = message.timestamp ? formatDate(message.timestamp, 'short') : '';
  const { isVoiceConversationMode, isDictationMode } = useVoiceModeCheck();
  
  // TTS playback hook for this message
  const {
    isGenerating,
    isPlaying,
    error,
    playAudio,
    stopAudio,
    clearError
  } = useTTSPlayback(message.content, message.id);
  
  // Handle copy message
  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };
  
  // Handle TTS button click
  const handleTTSClick = async () => {
    console.log(`🎯 TTS Button: Clicked for message ${message.id.substring(0, 8)}, isPlaying=${isPlaying}, isGenerating=${isGenerating}`);
    
    if (isPlaying) {
      console.log(`🎯 TTS Button: Stopping audio for message ${message.id.substring(0, 8)}`);
      stopAudio();
      return;
    }
    
    try {
      console.log(`🎯 TTS Button: Starting playAudio for message ${message.id.substring(0, 8)}`);
      // The enhanced useTTSPlayback hook automatically handles:
      // - Voice mode: Use shared audio if available, fallback to generation
      // - Text mode: Generate and play on-demand
      await playAudio();
      console.log(`🎯 TTS Button: playAudio completed for message ${message.id.substring(0, 8)}`);
    } catch (err) {
      console.error('TTS playAudio error:', err);
    }
  };
  
  return (
    <div 
      className={`chat-message assistant-message ${isStreamingMsg ? 'streaming-message' : ''} ${shouldUseCollapsible ? 'has-collapsible-content' : ''}`}
    >
      {/* Message content */}
      <div className="message-content-container">
        <div className="message-header">
          <span className="message-role">Assistant</span>
          {timestamp && (
            <span className="message-timestamp">{timestamp}</span>
          )}
          {isStreamingMsg && <span className="streaming-indicator">●</span>}
        </div>
        
        {/* Message content - use CollapsibleMessage for AI responses when enabled */}
        {shouldUseCollapsible ? (
          <CollapsibleMessage
            content={message.content}
            className="message-text"
            wordThreshold={effectiveWordThreshold}
            forceCollapsed={(isVoiceConversationMode || isDictationMode) && !isStreamingMsg}
          />
        ) : (
          <div 
            className="message-text"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.content || '') }}
          />
        )}
        
        {!isStreamingMsg && (
          <div className="message-actions">
            <button 
              className="action-button copy-button" 
              onClick={() => handleCopyMessage(message.content)}
              title="Copy message"
            >
              <Copy size={14} />
            </button>
            
            {/* TTS Play/Stop button - show in all modes with mode-aware behavior */}
            <button 
              className={`action-button tts-button ${isPlaying ? 'playing' : ''} ${isGenerating ? 'generating' : ''}`}
              onClick={handleTTSClick}
              disabled={isGenerating}
              title={
                isVoiceConversationMode 
                  ? (isPlaying ? 'Stop audio' : 'Play audio') 
                  : (isPlaying ? 'Stop audio' : 'Generate and play audio')
              }
            >
              {isGenerating ? <Loader size={14} /> : isPlaying ? <Pause size={14} /> : <AudioLines size={14} />}
            </button>
            

            
            {/* Error indicator */}
            {error && (
              <span 
                className="tts-error-indicator"
                title={error}
                onClick={clearError}
              >
                <AlertTriangle size={14} />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

/**
 * Component for displaying a list of chat messages
 */
export const MessageList: React.FC<MessageListProps> = observer(({
  messages,
  isLoading,
  className = '',
  loadingMessage = '', // Just show dots without text
  streamingMessage = null,
  isStreaming = false,
  enableCollapsibleMessages = true,
  collapsibleWordThreshold
}) => {
  // Standardized word threshold across all modes for consistent UX
  const effectiveWordThreshold = collapsibleWordThreshold ?? 30;
  // Create a reference for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  
  // Scroll to bottom when messages change, loading state changes, or streaming content updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage?.content, isStreaming]);
  
  // Empty state when no messages and no streaming
  if (!messages.length && !isLoading && !isStreaming) {
    return (
      <div className="empty-messages">
        <div className="empty-messages-icon">💬</div>
        <p>Start a conversation by typing a message below.</p>
      </div>
    );
  }
  
  const handleCopyMessage = (content: string) => {
    // Copy to clipboard
    navigator.clipboard.writeText(content);
  };
  
  const renderMessage = (message: Message, index: number, isStreamingMsg: boolean = false) => {
    const isUser = message.role === 'user';
    const timestamp = message.timestamp ? formatDate(message.timestamp, 'short') : '';
    
    // Determine if this message should use collapsible display (explicit boolean)
    // Exclude error/system messages like "Request was cancelled by user."
    const isErrorOrSystemMessage = message.content && (
      message.content.includes('Request was cancelled') ||
      message.content.includes('Error:') ||
      message.content.includes('cancelled by user') ||
      message.content.length < 20 // Very short messages are likely system messages
    );
    
    const shouldUseCollapsible: boolean = Boolean(
      enableCollapsibleMessages && 
      !isUser && 
      !isStreamingMsg && 
      message.content && 
      message.content.length > 0 &&
      !isErrorOrSystemMessage // Don't collapse error/system messages
    );
    
    // Use AIMessage component for assistant messages
    if (!isUser) {
      return (
        <AIMessage
          key={isStreamingMsg ? 'streaming-message' : `message-${index}`}
          message={message}
          isStreamingMsg={isStreamingMsg}
          shouldUseCollapsible={shouldUseCollapsible}
          effectiveWordThreshold={effectiveWordThreshold}
        />
      );
    }
    
    // Render user messages (simplified)
    return (
      <div 
        key={isStreamingMsg ? 'streaming-message' : `message-${index}`}
        className={`chat-message user-message ${isStreamingMsg ? 'streaming-message' : ''}`}
      >
        {/* Message content */}
        <div className="message-content-container">
          <div className="message-header">
            <span className="message-role">You</span>
            {timestamp && (
              <span className="message-timestamp">{timestamp}</span>
            )}
            {isStreamingMsg && <span className="streaming-indicator">●</span>}
          </div>
          
          <div 
            className="message-text"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.content || '') }}
          />
          
          {!isStreamingMsg && (
            <div className="message-actions">
              <button 
                className="action-button copy-button" 
                onClick={() => handleCopyMessage(message.content)}
                title="Copy message"
              >
                <Copy size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className={`messages-container ${className}`}>
      <div className="messages-list">
        {/* Render regular messages */}
        {messages.map((message, index) => renderMessage(message, index, false))}
        
        {/* Render streaming message - but only if it's not already in the messages array */}
        {isStreaming && streamingMessage && !messages.find(m => m.id === streamingMessage.id) && renderMessage(streamingMessage, -1, true)}
        
        {/* Loading indicator (only show if not streaming) */}
        {isLoading && !isStreaming && (
          <div className="loading-message">
            <div className="loading-indicator">
              <div className="loading-dot"></div>
              <div className="loading-dot"></div>
              <div className="loading-dot"></div>
              <div className="loading-dot"></div>
            </div>
            <div className="loading-text">{loadingMessage}</div>
          </div>
        )}
        

        
        {/* This div is used to scroll to the bottom */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}); 