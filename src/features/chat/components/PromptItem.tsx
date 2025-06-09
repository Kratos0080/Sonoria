// import React from 'react'; // Remove unused import

interface PromptItemProps {
  prompt: string;
  onSelect: (prompt: string) => void;
}

export function PromptItem({ prompt, onSelect }: PromptItemProps) {
  // TODO: Implement list item
  return (
    <li className="prompt-item" onClick={() => onSelect(prompt)}> {/* Placeholder className */}
      {prompt}
    </li>
  );
} 