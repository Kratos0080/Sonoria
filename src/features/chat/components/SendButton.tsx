import { Send, Square } from 'lucide-react';

interface SendButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isGenerating?: boolean;
  onStop?: () => void;
}

export function SendButton({ onClick, disabled, isGenerating = false, onStop }: SendButtonProps) {
  
  
  if (isGenerating && onStop) {
    return (
      <button
        className="send-button stop-button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
    
          onStop();
        }}
        disabled={false}  // Ensure stop button is always enabled
        aria-label="Stop generation"
        title="Stop generation"
      >
        <Square size={16} />
      </button>
    );
  }

  return (
    <button
      className="send-button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Send message"
      title="Send message"
    >
      <Send size={16} />
    </button>
  );
} 