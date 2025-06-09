import React from 'react';
import { X } from 'lucide-react';
import type { TFile } from 'obsidian';

interface NoteChipProps {
  note: TFile;
  onRemove: (notePath: string) => void;
  loadingState?: 'adding' | 'removing' | null;
}

/**
 * Displays a single selected note as a chip with a remove button.
 */
const NoteChip: React.FC<NoteChipProps> = ({ note, onRemove, loadingState }) => {
  const chipClass = `notechat-note-chip${loadingState ? ` loading-${loadingState}` : ''}`;
  
  // 🔧 INLINE STYLES FOR GUARANTEED VISIBILITY - Backup approach for loading animations
  const getLoadingStyle = (): React.CSSProperties => {
    if (loadingState === 'adding') {
      return {
        background: 'linear-gradient(45deg, #00ff00, #80ff80)',
        border: '3px solid #ff0000',
        color: '#000000',
        fontWeight: 'bold',
        transform: 'scale(1.1)',
        boxShadow: '0 0 20px #00ff00',
        animation: 'loading-pulse 0.5s ease-in-out infinite alternate',
        zIndex: 9999,
        position: 'relative'
      } as React.CSSProperties;
    }
    if (loadingState === 'removing') {
      return {
        background: 'linear-gradient(45deg, #ff0000, #ff8080)',
        border: '3px solid #0000ff',
        color: '#ffffff',
        fontWeight: 'bold',
        transform: 'scale(1.1)',
        boxShadow: '0 0 20px #ff0000',
        animation: 'loading-pulse 0.3s ease-in-out infinite alternate',
        zIndex: 9999,
        position: 'relative'
      } as React.CSSProperties;
    }
    return {};
  };
  
  // Debug logging to see if CSS classes are being applied
  console.log(`NoteChip: ${note.basename} - loadingState: ${loadingState}, chipClass: "${chipClass}"`);
  
  return (
    <div 
      className={chipClass} 
      style={getLoadingStyle()}
      title={note.path}
    >
      <span className="notechat-note-chip__name">{note.basename.replace(/\.md$/, '')}</span>
      <button 
        className="notechat-note-chip__remove" 
        onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation(); // Prevent click event from bubbling up
          onRemove(note.path);
        }}
        title={`Remove ${note.basename}`}
        disabled={loadingState === 'removing'}
      >
        <X size={12} />
      </button>
    </div>
  );
};

export default NoteChip; 