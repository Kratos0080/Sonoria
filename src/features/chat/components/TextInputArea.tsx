import React from 'react';
import { ChatInput } from './ChatInput';
import { SuggestedPromptsButton } from './SuggestedPromptsButton';
import { SendButton } from './SendButton';
import type { SuggestedPrompt } from './ChatInputArea'; // Import type from ChatInputArea

interface TextInputAreaProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onSelectPrompt: (prompt: string) => void;
  isSending: boolean;
  prompts: SuggestedPrompt[]; // Expecting full objects
  forceCloseSignal?: boolean; // Use boolean signal
  // 🛑 STOP GENERATION: Props for stop functionality
  isGenerating?: boolean;
  onStopGeneration?: () => void;
}

export function TextInputArea({
  inputValue,
  onInputChange,
  onSendMessage,
  onSelectPrompt,
  isSending,
  prompts, // Receive SuggestedPrompt[]
  forceCloseSignal, // Destructure boolean signal
  isGenerating = false,
  onStopGeneration,
}: TextInputAreaProps) {
  const handleInputChangeEvent = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onInputChange(e.target.value);
  };

  return (
    // Use className for styling, remove inline style
    <div className="text-input-area"> 
      {/* ChatInput takes up most space */}
      <ChatInput
        value={inputValue}
        onChange={handleInputChangeEvent}
        onSendViaEnter={onSendMessage}
        placeholder="Type your thought..." // Updated placeholder
        disabled={isSending}
        isLoading={isSending}
      />
      {/* Container for buttons */}
      <div className="text-input-area__buttons">
        <SuggestedPromptsButton 
          prompts={prompts} // Pass SuggestedPrompt[] directly
          onSelectPrompt={onSelectPrompt} 
          forceCloseSignal={forceCloseSignal} // Pass boolean signal down
        />
        <SendButton 
          onClick={() => onSendMessage()} 
          disabled={isSending || !inputValue.trim()} 
          isGenerating={isGenerating}
          onStop={onStopGeneration}
        />
      </div>
    </div>
  );
} 