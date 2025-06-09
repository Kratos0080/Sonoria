import { FilePlus } from 'lucide-react';

interface AddCurrentNoteButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Button specifically for adding the currently active Obsidian note to the context.
 */
function AddCurrentNoteButton({ onClick, disabled = false }: AddCurrentNoteButtonProps) {
  return (
    <button 
      className="notechat-add-current-button" 
      onClick={onClick}
      disabled={disabled}
      title="Add current note to context"
    >
      <FilePlus size={14} />
      Current
    </button>
  );
}

export default AddCurrentNoteButton; 