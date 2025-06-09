// import React from 'react'; // Remove unused import
import { PromptItem } from './PromptItem';
import type { SuggestedPrompt } from './ChatInputArea'; // Import type

interface SuggestedPromptsListProps {
  prompts: SuggestedPrompt[]; // Accept SuggestedPrompt[]
  onSelectPrompt: (prompt: string) => void;
  onClose: () => void;
}

export function SuggestedPromptsList({
  prompts, // Receive SuggestedPrompt[]
  onSelectPrompt,
  onClose,
}: SuggestedPromptsListProps) {

  const handleSelect = (promptText: string) => {
    onSelectPrompt(promptText);
    onClose(); // Close the list on selection
  };

  if (prompts.length === 0) {
    return null; // Don't render anything if no prompts
  }

  return (
    <ul className="suggested-prompts-list">
      {prompts.map((prompt) => (
        <PromptItem 
          key={prompt.text} // Use text as key (assuming it's unique enough for this list)
          prompt={prompt.text} // Pass only the text to PromptItem
          onSelect={handleSelect} // Use internal handler
        />
      ))}
    </ul>
  );
} 