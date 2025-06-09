import { Plus } from 'lucide-react';
import type { TFile } from 'obsidian';

interface RecentNoteItemProps {
  note: TFile;
  onAddNote: (file: TFile) => void;
}

/**
 * Displays a single recent note as a clickable chip to add it to the context.
 */
function RecentNoteItem({ note, onAddNote }: RecentNoteItemProps) {
  
  // Click handler for the entire chip
  const handleChipClick = () => {
    onAddNote(note);
  };

  return (
    // Use a button element for better accessibility and semantics, styled as a chip
    <button 
      className="notechat-recent-note-chip" 
      onClick={handleChipClick}
      title={`Add note: ${note.basename}`}
      aria-label={`Add note ${note.basename}`}
    >
      <span className="notechat-recent-note-chip__title">
        {note.basename.replace(/\.md$/, '')}
      </span>
      <span className="notechat-recent-note-chip__add-icon">
        <Plus size={12} />
      </span>
    </button>
  );
}

export default RecentNoteItem; 