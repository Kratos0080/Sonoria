// import React from 'react'; // Removed unused import
import { TextInputArea } from './TextInputArea';
import { VoiceInputArea } from './VoiceInputArea';
import { ModeToggleButton } from './ModeToggleButton';
import { useVoiceModeCheck } from '../context/VoiceModeContext';

// Define SuggestedPrompt locally if not exported elsewhere
export interface SuggestedPrompt {
  title: string;
  text: string;
}

/** Props for the ChatInputArea component */
export interface ChatInputAreaProps {
  /** Current value of the text input field. */
  inputValue: string;
  /** Callback function when the text input value changes. */
  onInputChange: (value: string) => void;
  /** Callback function to send a message, optionally overriding the input field content. */
  onSendMessage: (messageOverride?: string) => void;
  /** Callback when a suggested prompt is selected. */
  onSelectPrompt: (prompt: string) => void;
  /** Array of suggested prompts to display. */
  prompts: SuggestedPrompt[];
  /** Boolean indicating if a message is currently being sent/processed. */
  isSending: boolean;
  /** Optional CSS class name to apply to the container. */
  className?: string;
  /** Boolean signal to force close any open popups (e.g., suggested prompts). */
  forceCloseSignal?: boolean;
  /** 🛑 STOP GENERATION: Props for stop functionality */
  isGenerating?: boolean;
  onStopGeneration?: () => void;
}

/**
 * Main component for the chat input area.
 * Manages switching between text and voice input modes using VoiceModeContext.
 */
export const ChatInputArea: React.FC<ChatInputAreaProps> = ({
  inputValue,
  onInputChange,
  onSendMessage,
  onSelectPrompt,
  prompts,
  isSending,
  className = '',
  forceCloseSignal,
  isGenerating = false,
  onStopGeneration,
}) => {
  // Use voice mode context to determine which input area to show
  const { isVoiceMode } = useVoiceModeCheck();
  
  return (
    <div 
      className={`notechat-input-container ${className}`} 
    >
      <ModeToggleButton />
      
      <div className="notechat-input-area__main-wrapper">
        {isVoiceMode ? (
          <VoiceInputArea />
        ) : (
          <TextInputArea
            inputValue={inputValue}
            onInputChange={onInputChange}
            onSendMessage={onSendMessage}
            onSelectPrompt={onSelectPrompt}
            isSending={isSending}
            prompts={prompts}
            forceCloseSignal={forceCloseSignal}
            isGenerating={isGenerating}
            onStopGeneration={onStopGeneration}
          />
        )}
      </div>
    </div>
  );
} 