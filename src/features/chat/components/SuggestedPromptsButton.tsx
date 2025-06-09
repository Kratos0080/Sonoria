// import React, { useState, useEffect } from 'react';
import { useState, useEffect } from 'react';
import { Lightbulb } from 'lucide-react';
import { SuggestedPromptsList } from './SuggestedPromptsList';
import type { SuggestedPrompt } from './ChatInputArea'; // Import type

interface SuggestedPromptsButtonProps {
  onSelectPrompt: (prompt: string) => void;
  prompts: SuggestedPrompt[]; // Accept SuggestedPrompt[]
  forceCloseSignal?: boolean; // Use boolean signal
}

export function SuggestedPromptsButton({
  onSelectPrompt,
  prompts, // Receive SuggestedPrompt[]
  forceCloseSignal, // Destructure boolean signal
}: SuggestedPromptsButtonProps) {
  const [isListVisible, setIsListVisible] = useState(false);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    // Close the list only when the forceCloseSignal prop changes
    if (isListVisible) {
      console.log("SuggestedPromptsButton: forceCloseSignal changed, closing list.");
      setIsListVisible(false);
    }
  }, [forceCloseSignal]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // DEBUG: Log when toggle handler fires and the new state
  const handleToggleList = () => {
    const nextState = !isListVisible;
    console.log('handleToggleList called. Current state:', isListVisible, 'Next state:', nextState);
    setIsListVisible(nextState);
  };

  const handleSelect = (prompt: string) => {
    onSelectPrompt(prompt);
    setIsListVisible(false); // Close list after selection
  };

  // Use a simpler, static label
  const buttonLabel = "Suggested Prompts"; 

  // DEBUG: Log props and state before render
  // console.log('Rendering SuggestedPromptsButton. isListVisible:', isListVisible, 'Received prompts:', prompts);

  return (
    <div className="suggested-prompts-container">
      <button
        className="suggested-prompts-button"
        onClick={handleToggleList}
        aria-label={buttonLabel} // Use simple label
        title={buttonLabel} // Use simple label
      >
        <Lightbulb size={16} />
      </button>
      {isListVisible && (
        <> 
          <SuggestedPromptsList
            prompts={prompts} // Pass SuggestedPrompt[] down
            onSelectPrompt={handleSelect}
            onClose={() => setIsListVisible(false)} 
          />
        </>
      )}
    </div>
  );
} 