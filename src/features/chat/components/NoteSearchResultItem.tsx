import { Plus } from 'lucide-react';
import type { TFile } from 'obsidian';

interface NoteSearchResultItemProps {
  note: TFile;
  onAddNote: (file: TFile) => void;
  // isAdded prop not needed if list is pre-filtered
}

/**
 * Displays a single search result note as a clickable chip.
 */
function NoteSearchResultItem({ note, onAddNote }: NoteSearchResultItemProps) {
  
  const handleChipClick = () => {
    onAddNote(note);
  };

  return (
    <button 
      className="notechat-search-result-item" // Use a distinct class
      onClick={handleChipClick}
      title={`Add note: ${note.basename}`}
      aria-label={`Add note ${note.basename}`}
    >
      <span className="notechat-search-result-item__title">
        {note.basename.replace(/\.md$/, '')}
      </span>
      <span className="notechat-search-result-item__add-icon">
        <Plus size={12} />
      </span>
    </button>
  );
}

export default NoteSearchResultItem; 